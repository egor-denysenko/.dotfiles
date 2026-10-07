import type {
  ExtensionAPI,
  ExtensionCommandContext,
  ProviderConfig,
  ProviderModelConfig,
} from "@earendil-works/pi-coding-agent";
import type { OAuthCredentials, OAuthLoginCallbacks } from "@earendil-works/pi-ai";
import { execFile as execFileCallback } from "node:child_process";
import { chmod, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

const PROVIDER = "unsloth-studio";
const DEFAULT_BASE_URL = "http://127.0.0.1:8888/v1";
const DEFAULT_CONTEXT_WINDOW = 16_384;
const AUTH_PATH = join(homedir(), ".config", "pi", "agent", "auth.json");
const SETTINGS_PATH = join(homedir(), ".config", "pi", "agent", "unsloth.json");
const METAL_OVERCOMMIT_ENV = "UNSLOTH_ALLOW_METAL_CTX_OVERCOMMIT";
const execFile = promisify(execFileCallback);

type StoredCredential = {
  type?: string;
  access?: string;
  baseUrl?: string;
  contextWindow?: number;
};

type UnslothSettings = {
  allowMetalContextOvercommit?: boolean;
};

type ModelRecord = Record<string, unknown>;
type ModelsResponse = { data?: ModelRecord[] };
type RuntimeStatus = {
  active_model?: unknown;
  gguf_variant?: unknown;
  context_length?: unknown;
};
type AutoSwitchOverridesResponse = {
  overrides?: Record<string, { custom_context_length?: unknown }>;
};
type GgufVariant = {
  quant?: unknown;
  downloaded?: unknown;
  partial?: unknown;
  cleanable?: unknown;
};
type GgufVariantsResponse = { variants?: GgufVariant[] };
type ModelContextWindows = Map<string, number>;

function getQuant(record: ModelRecord): string | undefined {
  for (const key of ["quant", "quantization", "quantization_type"]) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return undefined;
}

function getBaseId(record: ModelRecord): string | undefined {
  if (typeof record.base_id === "string") return record.base_id;
  return typeof record.id === "string" ? record.id : undefined;
}

function modelKey(id: string, quant?: string): string {
  return quant ? `${id}:${quant}` : id;
}

function normalizeBaseUrl(value: string): string {
  const trimmed = value.trim().replace(/\/+$/, "");
  return trimmed.endsWith("/v1") ? trimmed : `${trimmed}/v1`;
}

function modelsUrl(baseUrl: string): string {
  return `${normalizeBaseUrl(baseUrl)}/models`;
}

function runtimeStatusUrl(baseUrl: string): string {
  return `${normalizeBaseUrl(baseUrl).replace(/\/v1$/, "")}/api/inference/status`;
}

function autoSwitchOverridesUrl(baseUrl: string): string {
  return `${normalizeBaseUrl(baseUrl).replace(/\/v1$/, "")}/api/settings/openai-auto-switch/overrides`;
}

function ggufVariantsUrl(baseUrl: string, id: string): string {
  const url = new URL(`${normalizeBaseUrl(baseUrl).replace(/\/v1$/, "")}/api/models/gguf-variants`);
  url.searchParams.set("repo_id", id);
  url.searchParams.set("prefer_local_cache", "true");
  return url.toString();
}

function finiteNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : undefined;
}

function isGenerationModel(id: string): boolean {
  return !/(^|[-_/])(embed|embedding|rerank|reranker)([-_/]|$)/i.test(id);
}

function isQwen(id: string): boolean {
  return /qwen/i.test(id);
}

function getBoolean(record: ModelRecord, ...keys: string[]): boolean | undefined {
  for (const key of keys) {
    if (typeof record[key] === "boolean") return record[key] as boolean;
  }
  return undefined;
}

function getContextWindow(
  record: ModelRecord,
  fallback: number,
  runtimeStatus?: RuntimeStatus,
  modelContexts?: ModelContextWindows,
): number {
  // Prefer Studio's loaded runtime setting, then its per-model UI override,
  // and finally retain compatibility with older /v1/models responses.
  const id = getBaseId(record);
  const quant = getQuant(record);
  const runtimeContext =
    runtimeStatus?.active_model === id &&
      (!quant || runtimeStatus.gguf_variant === quant)
      ? finiteNumber(runtimeStatus.context_length)
      : undefined;
  return (
    runtimeContext ??
    (id ? modelContexts?.get(modelKey(id, quant)) : undefined) ??
    (id ? modelContexts?.get(id) : undefined) ??
    finiteNumber(record.context_length) ??
    finiteNumber(record.contextWindow) ??
    finiteNumber(record.context_window) ??
    finiteNumber(record.max_context_length) ??
    finiteNumber(record.loaded_context_length) ??
    fallback
  );
}

function getMaxTokens(record: ModelRecord): number {
  return finiteNumber(record.maxTokens) ?? finiteNumber(record.max_tokens) ?? 4096;
}

function getInput(record: ModelRecord): ("text" | "image")[] {
  const input = record.input;
  if (Array.isArray(input) && input.every((item) => item === "text" || item === "image")) {
    return input.length > 0 ? input as ("text" | "image")[] : ["text"];
  }

  const vision = getBoolean(record, "vision", "supportsVision", "supports_vision");
  return vision ? ["text", "image"] : ["text"];
}

function toModels(
  records: ModelRecord[],
  contextWindow: number,
  runtimeStatus?: RuntimeStatus,
  modelContexts?: ModelContextWindows,
): ProviderModelConfig[] {
  return records.flatMap((record) => {
    const id = typeof record.id === "string" ? record.id : "";
    const baseId = getBaseId(record) ?? id;
    if (!id || !isGenerationModel(baseId)) return [];
    const quant = getQuant(record);

    // Studio enables thinking by default, even when /v1/models omits reasoning
    // metadata. Mark such models as reasoning-capable so pi emits the chat
    // template switch that disables Studio's implicit reasoning mode.
    const reportedReasoning = getBoolean(record, "reasoning", "supportsReasoning", "supports_reasoning");
    const reasoning = isQwen(baseId) ? (reportedReasoning ?? true) : true;
    const compat: NonNullable<ProviderModelConfig["compat"]> = {
      supportsDeveloperRole: false,
      supportsReasoningEffort: false,
      supportsUsageInStreaming: false,
      // Studio's chat template enables thinking by default. Disable it so the
      // reasoning trace cannot consume the whole completion budget before a
      // visible answer is produced.
      ...(reasoning && isQwen(baseId)
        ? { thinkingFormat: "qwen" as const }
        : {
            thinkingFormat: "chat-template" as const,
            chatTemplateKwargs: { enable_thinking: false },
          }),
    };

    return [{
      id,
      name: `${typeof record.name === "string" ? record.name : baseId}${quant ? ` [${quant}]` : ""}`,
      reasoning,
      input: getInput(record),
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
      contextWindow: getContextWindow(record, contextWindow, runtimeStatus, modelContexts),
      maxTokens: getMaxTokens(record),
      compat,
    }];
  });
}

async function readUnslothSettings(): Promise<UnslothSettings> {
  try {
    return JSON.parse(await readFile(SETTINGS_PATH, "utf8")) as UnslothSettings;
  } catch {
    return {};
  }
}

async function setMetalContextOvercommit(enabled: boolean): Promise<void> {
  if (enabled) {
    process.env[METAL_OVERCOMMIT_ENV] = "1";
  } else {
    delete process.env[METAL_OVERCOMMIT_ENV];
  }

  // launchctl is the only supported way to inject this into a GUI app that
  // Pi did not launch. Other operating systems retain the preference below,
  // but the user must restart Studio with the environment variable manually.
  if (process.platform === "darwin") {
    await execFile(
      "/bin/launchctl",
      enabled
        ? ["setenv", METAL_OVERCOMMIT_ENV, "1"]
        : ["unsetenv", METAL_OVERCOMMIT_ENV],
    );
  }

  await mkdir(join(homedir(), ".config", "pi", "agent"), { recursive: true });
  await writeFile(
    SETTINGS_PATH,
    `${JSON.stringify({ allowMetalContextOvercommit: enabled }, null, 2)}\n`,
    { mode: 0o600 },
  );
}

async function applyStoredMetalContextOvercommit(): Promise<void> {
  const settings = await readUnslothSettings();
  if (settings.allowMetalContextOvercommit !== undefined) {
    await setMetalContextOvercommit(settings.allowMetalContextOvercommit);
  }
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function isUnslothStudioRunning(): Promise<boolean> {
  try {
    await execFile("/usr/bin/pgrep", ["-f", "/Applications/Unsloth.app/Contents/MacOS/unsloth-studio"]);
    return true;
  } catch {
    return false;
  }
}

async function restartUnslothStudio(): Promise<void> {
  if (process.platform !== "darwin") return;

  if (await isUnslothStudioRunning()) {
    await execFile("/usr/bin/osascript", [
      "-e",
      "tell application id \"ai.unsloth.studio\" to quit",
    ]);

    for (let attempt = 0; attempt < 30 && await isUnslothStudioRunning(); attempt += 1) {
      await delay(500);
    }
    if (await isUnslothStudioRunning()) {
      throw new Error("Unsloth Studio did not quit within 15 seconds");
    }
  }

  await execFile("/usr/bin/open", ["-a", "Unsloth"]);
}

async function readStoredCredential(): Promise<StoredCredential | undefined> {
  try {
    const raw = await readFile(AUTH_PATH, "utf8");
    const parsed = JSON.parse(raw) as Record<string, StoredCredential>;
    const credential = parsed[PROVIDER];
    return credential?.type === "oauth" ? credential : undefined;
  } catch {
    return undefined;
  }
}

async function expandQuantVariants(
  records: ModelRecord[],
  baseUrl: string,
  headers: { Authorization: string },
): Promise<ModelRecord[]> {
  const groups = await Promise.all(records.map(async (record): Promise<ModelRecord[]> => {
    const id = typeof record.id === "string" ? record.id : undefined;
    if (!id || !getQuant(record)) return [record];

    try {
      const response = await fetch(ggufVariantsUrl(baseUrl, id), { headers });
      if (!response.ok) return [record];
      const payload = await response.json() as GgufVariantsResponse;
      const variants = Array.isArray(payload.variants)
        ? payload.variants.filter((variant) =>
            typeof variant.quant === "string" &&
            variant.downloaded === true &&
            variant.partial !== true &&
            variant.cleanable !== true
          )
        : [];
      if (variants.length === 0) return [record];

      return variants.map((variant) => {
        const quant = variant.quant as string;
        return { ...record, id: modelKey(id, quant), base_id: id, quant };
      });
    } catch {
      // Older Studio versions may not expose variant discovery. Keep the
      // catalog record rather than making the whole provider unavailable.
      return [record];
    }
  }));
  return groups.flat();
}

async function discover(
  baseUrl: string,
  apiKey: string,
): Promise<{
  records: ModelRecord[];
  runtimeStatus?: RuntimeStatus;
  modelContexts: ModelContextWindows;
}> {
  const headers = { Authorization: `Bearer ${apiKey}` };
  const [modelsResult, statusResult, overridesResult] = await Promise.allSettled([
    fetch(modelsUrl(baseUrl), { headers }),
    fetch(runtimeStatusUrl(baseUrl), { headers }),
    fetch(autoSwitchOverridesUrl(baseUrl), { headers }),
  ]);
  if (modelsResult.status === "rejected") throw modelsResult.reason;
  if (!modelsResult.value.ok) throw new Error(`Studio returned HTTP ${modelsResult.value.status}`);

  const payload = await modelsResult.value.json() as ModelsResponse;
  let runtimeStatus: RuntimeStatus | undefined;
  if (statusResult.status === "fulfilled" && statusResult.value.ok) {
    try {
      runtimeStatus = await statusResult.value.json() as RuntimeStatus;
    } catch {
      // The runtime-status endpoint is optional; the catalog still supports
      // older Studio versions and remains sufficient when its JSON is invalid.
    }
  }
  const catalogRecords = Array.isArray(payload.data) ? payload.data : [];
  const records = await expandQuantVariants(catalogRecords, baseUrl, headers);
  const modelContexts: ModelContextWindows = new Map();
  if (overridesResult.status === "fulfilled" && overridesResult.value.ok) {
    try {
      const { overrides } = await overridesResult.value.json() as AutoSwitchOverridesResponse;
      for (const record of records) {
        const id = getBaseId(record);
        const quant = getQuant(record);
        if (!id) continue;
        // Studio stores per-model UI settings under <model-id>:<quant>.
        const key = modelKey(id, quant);
        const override = overrides?.[key] ?? overrides?.[id];
        const contextWindow = finiteNumber(override?.custom_context_length);
        if (contextWindow) modelContexts.set(key, contextWindow);
      }
    } catch {
      // The overrides endpoint is optional; retain catalog fields or fallback.
    }
  }
  return { records, runtimeStatus, modelContexts };
}

function providerConfig(
  oauth: NonNullable<ProviderConfig["oauth"]>,
  baseUrl = DEFAULT_BASE_URL,
  apiKey = PROVIDER,
) {
  return {
    name: "Unsloth Studio",
    baseUrl,
    api: "openai-completions" as const,
    apiKey,
    authHeader: true,
    oauth,
  };
}

async function saveCredential(credential: OAuthCredentials): Promise<void> {
  let data: Record<string, unknown> = {};
  try {
    data = JSON.parse(await readFile(AUTH_PATH, "utf8")) as Record<string, unknown>;
  } catch {
    // Create the auth file when this is the first local provider login.
  }

  data[PROVIDER] = { type: "oauth", ...credential };
  await mkdir(join(homedir(), ".config", "pi", "agent"), { recursive: true });
  const temporaryPath = `${AUTH_PATH}.tmp-${process.pid}`;
  await writeFile(temporaryPath, `${JSON.stringify(data, null, 2)}\n`, { mode: 0o600 });
  await chmod(temporaryPath, 0o600);
  await rename(temporaryPath, AUTH_PATH);
}

export default function (pi: ExtensionAPI) {
  let refresh: ((ctx?: ExtensionCommandContext) => Promise<void>) | undefined;

  const oauth = {
    name: "Unsloth Studio",
    async login(callbacks: OAuthLoginCallbacks): Promise<OAuthCredentials> {
      const endpoint = await callbacks.onPrompt({
        message: "Unsloth Studio endpoint",
        placeholder: DEFAULT_BASE_URL,
      });
      const baseUrl = normalizeBaseUrl(endpoint?.trim() || DEFAULT_BASE_URL);

      const apiKey = await callbacks.onPrompt({
        message: "Unsloth Studio API key",
        placeholder: "",
      });
      if (!apiKey?.trim()) throw new Error("Unsloth Studio login cancelled");

      const context = await callbacks.onPrompt({
        message: "Fallback context window when Studio does not report one (optional)",
        placeholder: String(DEFAULT_CONTEXT_WINDOW),
      });
      const contextWindow = finiteNumber(Number(context)) ?? DEFAULT_CONTEXT_WINDOW;

      callbacks.onProgress?.("Testing Unsloth Studio and discovering loaded models…");
      const { records, runtimeStatus, modelContexts } = await discover(baseUrl, apiKey.trim());
      if (records.length === 0) throw new Error("Unsloth Studio returned no models");

      const credentials: OAuthCredentials = {
        refresh: "unsloth-studio-local",
        access: apiKey.trim(),
        expires: Date.now() + 10 * 365 * 24 * 60 * 60 * 1000,
        baseUrl,
        contextWindow,
      };

      pi.registerProvider(PROVIDER, {
        ...providerConfig(oauth, baseUrl, apiKey.trim()),
        models: toModels(records, contextWindow, runtimeStatus, modelContexts),
      });
      return credentials;
    },
    async refreshToken(credentials: OAuthCredentials): Promise<OAuthCredentials> {
      return credentials;
    },
    getApiKey(credentials: OAuthCredentials): string {
      return credentials.access;
    },
  };

  const registerEmptyProvider = () => {
    pi.registerProvider(PROVIDER, providerConfig(oauth));
  };

  refresh = async (ctx?: ExtensionCommandContext) => {
    let credential = await readStoredCredential();
    if (!credential?.access) {
      if (!ctx) return;

      const endpoint = await ctx.ui.input("Unsloth Studio endpoint", DEFAULT_BASE_URL);
      const apiKey = await ctx.ui.input("Unsloth Studio API key", "");
      if (!apiKey?.trim()) return;
      const context = await ctx.ui.input(
        "Fallback context window when Studio does not report one (optional)",
        String(DEFAULT_CONTEXT_WINDOW),
      );

      const baseUrl = normalizeBaseUrl(endpoint?.trim() || DEFAULT_BASE_URL);
      const { records } = await discover(baseUrl, apiKey.trim());
      if (records.length === 0) throw new Error("Unsloth Studio returned no models");

      const contextWindow = finiteNumber(Number(context)) ?? DEFAULT_CONTEXT_WINDOW;
      await saveCredential({
        refresh: "unsloth-studio-local",
        access: apiKey.trim(),
        expires: Date.now() + 10 * 365 * 24 * 60 * 60 * 1000,
        baseUrl,
        contextWindow,
      });
      credential = { type: "oauth", access: apiKey.trim(), baseUrl, contextWindow };
    }
    if (!credential?.access) return;

    const baseUrl = normalizeBaseUrl(credential.baseUrl ?? DEFAULT_BASE_URL);
    const contextWindow = finiteNumber(credential.contextWindow) ?? DEFAULT_CONTEXT_WINDOW;
    const { records, runtimeStatus, modelContexts } = await discover(baseUrl, credential.access);
    const models = toModels(records, contextWindow, runtimeStatus, modelContexts);

    pi.registerProvider(PROVIDER, {
      ...providerConfig(oauth, baseUrl, credential.access),
      models,
    });
    const contexts = models
      .map((model) => `${model.name}: ${model.contextWindow.toLocaleString()} tokens`)
      .join("; ");
    ctx?.ui.notify(
      `Unsloth Studio: ${models.length} model${models.length === 1 ? "" : "s"} discovered (${contexts}).`,
      "info",
    );
  };

  registerEmptyProvider();
  void applyStoredMetalContextOvercommit().catch(() => {
    // This only prepares the environment inherited by the next Studio launch.
    // Provider discovery remains usable if launchctl is unavailable.
  });

  pi.registerCommand("unsloth-metal-overcommit", {
    description: "Toggle Unsloth Metal context overcommit (on/off/status)",
    async handler(args, ctx) {
      const requested = args.trim().toLowerCase();
      const current = (await readUnslothSettings()).allowMetalContextOvercommit === true;
      if (requested === "status") {
        ctx.ui.notify(`Unsloth Metal context overcommit: ${current ? "ON" : "OFF"}`, "info");
        return;
      }
      if (requested && requested !== "on" && requested !== "off") {
        ctx.ui.notify("Usage: /unsloth-metal-overcommit [on|off|status]", "error");
        return;
      }

      const enabled = requested === "on" || (requested === "" && !current);
      if (enabled) {
        const confirmed = await ctx.ui.confirm(
          "Enable unsafe Metal context overcommit?",
          "This bypasses Unsloth's memory safety check and can freeze or terminate macOS under memory pressure.",
        );
        if (!confirmed) return;
      }

      try {
        await setMetalContextOvercommit(enabled);
        if (process.platform === "darwin") {
          ctx.ui.notify(
            `Unsloth Metal context overcommit: ${enabled ? "ON" : "OFF"}. Restarting Unsloth Studio…`,
            enabled ? "warning" : "info",
          );
          await restartUnslothStudio();
          ctx.ui.notify("Unsloth Studio restarted with the new setting.", "info");
        } else {
          const instruction = enabled
            ? `restart it manually with ${METAL_OVERCOMMIT_ENV}=1`
            : `unset ${METAL_OVERCOMMIT_ENV}, then restart it manually`;
          ctx.ui.notify(
            `Automatic Unsloth Studio restart is unsupported on ${process.platform}; ${instruction}.`,
            "warning",
          );
        }
      } catch (error) {
        ctx.ui.notify(
          `Could not update Metal context overcommit: ${error instanceof Error ? error.message : String(error)}`,
          "error",
        );
      }
    },
  });

  pi.registerCommand("unsloth-refresh", {
    description: "Discover models currently loaded in Unsloth Studio",
    async handler(_args, ctx) {
      try {
        await refresh?.(ctx);
      } catch (error) {
        ctx.ui.notify(`Unsloth refresh failed: ${error instanceof Error ? error.message : String(error)}`, "error");
      }
    },
  });

  void (async () => {
    const credential = await readStoredCredential();
    if (!credential?.access) return;

    try {
      const baseUrl = normalizeBaseUrl(credential.baseUrl ?? DEFAULT_BASE_URL);
      const contextWindow = finiteNumber(credential.contextWindow) ?? DEFAULT_CONTEXT_WINDOW;
      const { records, runtimeStatus, modelContexts } = await discover(baseUrl, credential.access);
      const models = toModels(records, contextWindow, runtimeStatus, modelContexts);
      if (models.length > 0) {
        pi.registerProvider(PROVIDER, {
          ...providerConfig(oauth, baseUrl, credential.access),
          models,
        });
      }
    } catch {
      // Studio is optional. Keep the empty provider so /login remains available.
    }
  })();
}
