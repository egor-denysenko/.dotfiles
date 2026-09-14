import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { readCatalog, writeCatalog } from "./catalog-cache";

type CompatConfig = {
  supportsDeveloperRole?: boolean;
  supportsReasoningEffort?: boolean;
  maxTokensField?: "max_completion_tokens" | "max_tokens";
  thinkingFormat?:
    | "openai"
    | "openrouter"
    | "deepseek"
    | "together"
    | "zai"
    | "qwen"
    | "qwen-chat-template"
    | "string-thinking"
    | "ant-ling";
};

type ModelOverride = {
  id: string;
  reasoning?: boolean;
  compat?: CompatConfig;
  thinkingFormat?: CompatConfig["thinkingFormat"];
};

type LiteLLMProviderConfig = {
  baseUrl?: string;
  apiKey?: string;
  compat?: CompatConfig;
  models?: ModelOverride[];
};

type ModelsResponse = {
  data?: Array<Record<string, unknown>>;
};

type AuthFile = Record<string, { type: string; key: string }>;

const MODELS_PATH = join(homedir(), ".config", "pi", "agent", "models.json");
const AUTH_PATH = join(homedir(), ".config", "pi", "agent", "auth.json");
const DEFAULT_BASE_URL = "https://litellm.porchettos.space/v1";

function asNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function isGenerationModel(id: string): boolean {
  return !/(^|[-_/])(embed|embedding|rerank)([-_/]|$)/i.test(id);
}

function isLiteLlmModel(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && typeof (value as Record<string, unknown>).id === "string");
}

function log(msg: string) {
  if (process.env.LITELLM_DEBUG) console.log(`[litellm] ${msg}`);
}

function inferCompat(id: string): CompatConfig {
  const lower = id.toLowerCase();
  if (lower.includes("gemini")) {
    return { supportsDeveloperRole: false, supportsReasoningEffort: false };
  }
  if (lower.includes("claude")) {
    return {
      supportsDeveloperRole: true,
      supportsReasoningEffort: true,
      thinkingFormat: "ant-ling",
      maxTokensField: "max_tokens",
    };
  }
  if (lower.includes("deepseek") || lower.includes("reasoning")) {
    return { supportsReasoningEffort: true };
  }
  return {};
}

async function readProviderConfig(): Promise<{
  config: LiteLLMProviderConfig;
  authKey: string;
}> {
  const config: LiteLLMProviderConfig = {};
  let authKey = "";

  try {
    const raw = await readFile(MODELS_PATH, "utf-8");
    const parsed = JSON.parse(raw) as {
      providers?: { llmgateway?: LiteLLMProviderConfig };
    };
    const provider = parsed.providers?.llmgateway;
    if (provider) {
      if (provider.baseUrl) config.baseUrl = provider.baseUrl;
      if (provider.apiKey) config.apiKey = provider.apiKey;
      if (provider.compat) config.compat = provider.compat;
      if (provider.models) config.models = provider.models;
    }
  } catch (e) {
    log(`failed to read models.json: ${e}`);
  }

  try {
    const raw = await readFile(AUTH_PATH, "utf-8");
    const parsed = JSON.parse(raw) as AuthFile;
    authKey = parsed.llmgateway?.key ?? "";
  } catch (e) {
    log(`failed to read auth.json: ${e}`);
  }

  log(
    `config: baseUrl=${config.baseUrl ?? "default"}, modelsApiKey=${config.apiKey ? "set" : "missing"}, authKey=${authKey ? "set" : "missing"}`,
  );

  return { config, authKey };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchLitellmModels(
  baseUrl: string,
  apiKey: string,
): Promise<Array<Record<string, unknown>>> {
  const normalized = baseUrl.replace(/\/+$/, "");
  const endpoint = normalized.endsWith("/v1")
    ? `${normalized}/models`
    : `${normalized}/v1/models`;

  log(`fetching models from ${endpoint}`);

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch(endpoint, {
        headers: { Authorization: `Bearer ${apiKey}` },
        signal: AbortSignal.timeout(5000),
      });
      const text = await response.text();
      const contentType = response.headers.get("content-type") ?? "";
      const loadingPage = contentType.includes("text/html") ||
        text.trim().startsWith("<!DOCTYPE html>") || text.includes("Sablier");

      if (!response.ok || loadingPage) {
        log(`attempt ${attempt}/3 returned an unusable response`);
      } else {
        const payload = JSON.parse(text) as ModelsResponse;
        if (Array.isArray(payload.data)) {
          log(`fetched ${payload.data.length} models from server`);
          await writeCatalog("llmgateway-models", payload.data);
          return payload.data;
        }
        log(`attempt ${attempt}/3 returned no model data`);
      }
    } catch (error) {
      log(`attempt ${attempt}/3 failed: ${error}`);
    }

    if (attempt < 3) await sleep(1000);
  }

  log("model fetch retries exhausted; using cached catalog");
  return readCatalog<Record<string, unknown>>("llmgateway-models", isLiteLlmModel);
}

function buildModels(
  remoteModels: Array<Record<string, unknown>>,
  config: LiteLLMProviderConfig,
) {
  const overrides = new Map<string, ModelOverride>();
  for (const model of config.models ?? []) {
    if (model?.id) overrides.set(model.id, model);
  }

  return remoteModels
    .map((entry) => {
      const id = typeof entry.id === "string" ? entry.id : "";
      if (!id || !isGenerationModel(id)) return;

      const override = overrides.get(id);
      const compat: CompatConfig = {
        ...inferCompat(id),
        ...config.compat,
        ...override?.compat,
      };
      if (override?.thinkingFormat) {
        compat.thinkingFormat = override.thinkingFormat;
      }

      return {
        id,
        name: id,
        reasoning: override?.reasoning ?? false,
        input: ["text"],
        cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
        contextWindow:
          asNumber(entry.max_input_tokens) ??
          asNumber(entry.max_context_length) ??
          asNumber(entry.context_length) ??
          asNumber(entry.context_window) ??
          asNumber(entry.contextWindow) ??
          128000,
        maxTokens:
          asNumber(entry.max_output_tokens) ??
          asNumber(entry.max_tokens) ??
          asNumber(entry.maxTokens) ??
          4096,
        compat,
      };
    })
    .filter((m): m is NonNullable<typeof m> => Boolean(m));
}

export default async function (pi: ExtensionAPI) {
  const { config, authKey } = await readProviderConfig();
  const baseUrl = config.baseUrl ?? DEFAULT_BASE_URL;
  const apiKey = config.apiKey || authKey;

  if (!apiKey) {
    log("no API key found — provider not registered");
    return;
  }

  const remoteModels = await fetchLitellmModels(baseUrl, apiKey).catch((e) => {
    log(`initial fetch failed: ${e}`);
    return [] as Array<Record<string, unknown>>;
  });
  if (remoteModels.length === 0) {
    log("no models returned from server — provider not registered");
    return;
  }

  const models = buildModels(remoteModels, config);
  if (models.length === 0) {
    log("all fetched models filtered out — provider not registered");
    return;
  }

  log(`registering provider with ${models.length} models`);

  pi.registerProvider("llmgateway", {
    baseUrl,
    apiKey,
    api: "openai-completions",
    models,
    async refreshModels(ctx) {
      log("refreshing models...");
      try {
        const freshModels = await fetchLitellmModels(baseUrl, apiKey);
        const built = buildModels(freshModels, config);
        log(`refresh complete: ${built.length} models`);
        return built;
      } catch (e) {
        log(`refresh failed: ${e}`);
        return models;
      }
    },
  });
}
