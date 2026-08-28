import type {
  ExtensionAPI,
  ExtensionCommandContext,
  ProviderConfig,
  ProviderModelConfig,
} from "@earendil-works/pi-coding-agent";
import type { OAuthCredentials, OAuthLoginCallbacks } from "@earendil-works/pi-ai";
import { chmod, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

const PROVIDER = "unsloth-studio";
const DEFAULT_BASE_URL = "http://127.0.0.1:8888/v1";
const DEFAULT_CONTEXT_WINDOW = 16_384;
const AUTH_PATH = join(homedir(), ".config", "pi", "agent", "auth.json");

type StoredCredential = {
  type?: string;
  access?: string;
  baseUrl?: string;
  contextWindow?: number;
};

type ModelRecord = Record<string, unknown>;
type ModelsResponse = { data?: ModelRecord[] };

function normalizeBaseUrl(value: string): string {
  const trimmed = value.trim().replace(/\/+$/, "");
  return trimmed.endsWith("/v1") ? trimmed : `${trimmed}/v1`;
}

function modelsUrl(baseUrl: string): string {
  return `${normalizeBaseUrl(baseUrl)}/models`;
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

function getContextWindow(record: ModelRecord, fallback: number): number {
  // Unsloth Studio's /v1/models reports the actual runtime setting as
  // `context_length`, including a --max-seq-length/--context-length CLI override.
  return (
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

function toModels(records: ModelRecord[], contextWindow: number): ProviderModelConfig[] {
  return records.flatMap((record) => {
    const id = typeof record.id === "string" ? record.id : "";
    if (!id || !isGenerationModel(id)) return [];

    const reasoning = getBoolean(record, "reasoning", "supportsReasoning", "supports_reasoning") ?? isQwen(id);
    const compat: NonNullable<ProviderModelConfig["compat"]> = {
      supportsDeveloperRole: false,
      supportsReasoningEffort: false,
      supportsUsageInStreaming: false,
      ...(reasoning && isQwen(id) ? { thinkingFormat: "qwen" as const } : {}),
    };

    return [{
      id,
      name: typeof record.name === "string" ? record.name : id,
      reasoning,
      input: getInput(record),
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
      contextWindow: getContextWindow(record, contextWindow),
      maxTokens: getMaxTokens(record),
      compat,
    }];
  });
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

async function discover(baseUrl: string, apiKey: string): Promise<ModelRecord[]> {
  const response = await fetch(modelsUrl(baseUrl), {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (!response.ok) throw new Error(`Studio returned HTTP ${response.status}`);

  const payload = await response.json() as ModelsResponse;
  return Array.isArray(payload.data) ? payload.data : [];
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
      const records = await discover(baseUrl, apiKey.trim());
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
        models: toModels(records, contextWindow),
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
      const records = await discover(baseUrl, apiKey.trim());
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
    const records = await discover(baseUrl, credential.access);
    const models = toModels(records, contextWindow);

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
      const models = toModels(await discover(baseUrl, credential.access), contextWindow);
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
