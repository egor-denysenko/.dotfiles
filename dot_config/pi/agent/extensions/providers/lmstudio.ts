import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

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
    | "chat-template"
    | "qwen-chat-template"
    | "string-thinking"
    | "ant-ling";
};

type LocalModelOverride = {
  id: string;
  reasoning?: boolean;
  compat?: CompatConfig;
  thinkingFormat?: CompatConfig["thinkingFormat"];
};

type LocalProviderConfig = {
  baseUrl: string;
  apiKey: string;
  compat: CompatConfig;
  overrides: Map<string, LocalModelOverride>;
};

type ModelsResponse = {
  data?: Array<Record<string, unknown>>;
};

type ModelMeta = {
  max_context_length?: number;
  loaded_context_length?: number;
  max_tokens?: number;
  state?: string;
};

const MODELS_PATH = join(homedir(), ".config", "pi", "agent", "models.json");
const DEFAULT_BASE_URL = "http://127.0.0.1:1234/v1";
const DEFAULT_API_KEY = "lm-studio";

function getModelsEndpoint(baseUrl: string): string {
  const normalized = baseUrl.replace(/\/+$/, "");
  if (normalized.endsWith("/v1")) return `${normalized}/models`;
  return `${normalized}/v1/models`;
}

function getNativeModelsEndpoint(baseUrl: string): string {
  const normalized = baseUrl.replace(/\/+$/, "");
  if (normalized.endsWith("/v1")) return `${normalized.slice(0, -3)}/api/v0/models`;
  return `${normalized}/api/v0/models`;
}

function asNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function isGenerationModel(id: string): boolean {
  return !/(^|[-_/])(embed|embedding|rerank)([-_/]|$)/i.test(id);
}

async function readLocalProviderConfig(): Promise<LocalProviderConfig> {
  try {
    const raw = await readFile(MODELS_PATH, "utf-8");
    const parsed = JSON.parse(raw) as {
      providers?: {
        lmstudio?: {
          baseUrl?: string;
          apiKey?: string;
          compat?: CompatConfig;
          models?: LocalModelOverride[];
        };
      };
    };

    const provider = parsed.providers?.lmstudio;
    const overrides = new Map<string, LocalModelOverride>();
    for (const model of provider?.models ?? []) {
      if (model?.id) overrides.set(model.id, model);
    }

    return {
      baseUrl: provider?.baseUrl ?? DEFAULT_BASE_URL,
      apiKey: provider?.apiKey ?? DEFAULT_API_KEY,
      compat: provider?.compat ?? {},
      overrides,
    };
  } catch {
    return {
      baseUrl: DEFAULT_BASE_URL,
      apiKey: DEFAULT_API_KEY,
      compat: {},
      overrides: new Map<string, LocalModelOverride>(),
    };
  }
}

async function fetchRemoteModels(baseUrl: string, apiKey: string): Promise<Array<Record<string, unknown>>> {
  const endpoint = getModelsEndpoint(baseUrl);
  const response = await fetch(endpoint, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (!response.ok) return [];
  const payload = (await response.json()) as ModelsResponse;
  if (!Array.isArray(payload.data)) return [];
  return payload.data;
}

async function fetchNativeModelMeta(baseUrl: string): Promise<Map<string, ModelMeta>> {
  const endpoint = getNativeModelsEndpoint(baseUrl);
  const response = await fetch(endpoint);
  if (!response.ok) return new Map();
  const payload = (await response.json()) as ModelsResponse;
  if (!Array.isArray(payload.data)) return new Map();

  const out = new Map<string, ModelMeta>();
  for (const entry of payload.data) {
    const id = typeof entry.id === "string" ? entry.id : "";
    if (!id) continue;
    out.set(id, {
      max_context_length: asNumber(entry.max_context_length),
      loaded_context_length: asNumber(entry.loaded_context_length),
      max_tokens: asNumber(entry.max_tokens),
      state: typeof entry.state === "string" ? entry.state : undefined,
    });
  }
  return out;
}

export default async function (pi: ExtensionAPI) {
  const local = await readLocalProviderConfig();
  const remoteModels = await fetchRemoteModels(local.baseUrl, local.apiKey).catch(() => []);
  const nativeMeta = await fetchNativeModelMeta(local.baseUrl).catch(() => new Map<string, ModelMeta>());

  if (remoteModels.length === 0) {
    return;
  }

  const models = remoteModels
    .map((entry) => {
      const id = typeof entry.id === "string" ? entry.id : "";
      if (!id || !isGenerationModel(id)) return undefined;

      const override = local.overrides.get(id);
      const meta = nativeMeta.get(id);
      const contextWindow =
        asNumber(meta?.loaded_context_length) ??
        asNumber(entry.loaded_context_length) ??
        asNumber(entry.context_window) ??
        asNumber(entry.contextWindow) ??
        asNumber(meta?.max_context_length) ??
        asNumber(entry.max_context_length) ??
        128000;
      const maxTokens =
        asNumber(meta?.max_tokens) ??
        asNumber(entry.max_tokens) ??
        asNumber(entry.maxTokens) ??
        4096;

      const modelCompat: CompatConfig = {
        ...local.compat,
        ...override?.compat,
      };
      if (override?.thinkingFormat) {
        modelCompat.thinkingFormat = override.thinkingFormat;
      }

      return {
        id,
        name: id,
        reasoning: override?.reasoning ?? false,
        input: ["text"],
        cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
        contextWindow,
        maxTokens,
        compat: modelCompat,
      };
    })
    .filter((model): model is NonNullable<typeof model> => Boolean(model));

  if (models.length === 0) {
    return;
  }

  pi.registerProvider("lmstudio", {
    baseUrl: local.baseUrl,
    apiKey: local.apiKey,
    api: "openai-completions",
    models,
  });
}
