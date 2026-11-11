import { getApiProvider } from "@earendil-works/pi-ai";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { readCatalog, writeCatalog } from "./catalog-cache";

const GATEWAY_URL = process.env.APERTURE_BRIDGE_ENDPOINT ?? "http://localhost:8992";
const BASE_URL = `${GATEWAY_URL.replace(/\/+$/, "")}/v1`;
const PROVIDER = "aperture-bridge";

type ApiRoute = "openai-completions" | "openai-responses" | "anthropic-messages" | "bedrock-converse-stream";
type ModelRecord = Record<string, unknown> & { id: string };
type ModelsResponse = { data?: unknown };
type ApiModel = {
  id: string;
  name: string;
  reasoning: boolean;
  input: ("text" | "image")[];
  cost: { input: number; output: number; cacheRead: number; cacheWrite: number };
  contextWindow: number;
  maxTokens: number;
  api: ApiRoute;
  baseUrl: string;
  compat?: { forceAdaptiveThinking: boolean };
};

function isModel(value: unknown): value is ModelRecord {
  return Boolean(value && typeof value === "object" && typeof (value as ModelRecord).id === "string");
}

function positiveNumber(value: unknown, fallback: number): number {
  const n = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function apiForEndpoints(endpoints: unknown): ApiRoute | undefined {
  if (!Array.isArray(endpoints)) return "openai-completions";
  if (endpoints.includes("/v1/responses")) return "openai-responses";
  if (endpoints.includes("/v1/chat/completions")) return "openai-completions";
  if (endpoints.includes("/v1/messages")) return "anthropic-messages";
  if (endpoints.includes("/bedrock/model/{model}/converse-stream")) return "bedrock-converse-stream";
}

function routeBaseUrl(api: ApiRoute): string {
  if (api === "anthropic-messages") return GATEWAY_URL;
  if (api === "bedrock-converse-stream") return `${GATEWAY_URL}/bedrock`;
  return BASE_URL;
}

function supportsReasoning(record: ModelRecord, api: ApiRoute): boolean {
  if (typeof record.reasoning === "boolean") return record.reasoning;
  if (typeof record.supports_reasoning === "boolean") return record.supports_reasoning;

  // Aperture currently omits capability metadata. Only infer known reasoning
  // families on their native APIs; explicit catalog metadata always wins.
  if (api === "openai-responses") return /^gpt-(?:[5-9]|[1-9]\d+)(?:[.-]|$)/i.test(record.id);
  if (api === "anthropic-messages") return /^claude-(?:[a-z]+-)?(?:3[.-]7|[4-9]|[1-9]\d+)(?:[.-]|$)/i.test(record.id);
  return false;
}

function buildModels(records: ModelRecord[]): { models: ApiModel[]; routes: Map<string, ApiRoute> } {
  const routes = new Map<string, ApiRoute>();
  const models = records.flatMap((record) => {
    const id = record.id;
    const api = apiForEndpoints(record.supported_endpoints);
    if (!api || routes.has(id) || /(^|[-_/])(embed|embedding|rerank)([-_/]|$)/i.test(id)) return [];
    routes.set(id, api);
    return [{
      id,
      name: typeof record.display_name === "string" ? record.display_name : id,
      reasoning: supportsReasoning(record, api),
      input: Array.isArray(record.input_modalities) && record.input_modalities.includes("image") ? ["text", "image"] : ["text"],
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
      contextWindow: positiveNumber(record.context_window_tokens ?? record.context_length ?? record.max_input_tokens, 128000),
      maxTokens: positiveNumber(record.max_output_tokens ?? record.max_tokens, 8192),
      api,
      baseUrl: routeBaseUrl(api),
      ...(api === "anthropic-messages" && /^claude-(?:[a-z]+-)?(?:4[.-](?:[6-9]|[1-9]\d+)|[5-9]|[1-9]\d+)(?:[.-]|$)/i.test(id)
        ? { compat: { forceAdaptiveThinking: true } }
        : {}),
    }];
  });
  return { models, routes };
}

async function fetchModels(): Promise<ModelRecord[]> {
  try {
    const response = await fetch(`${BASE_URL}/models`, { signal: AbortSignal.timeout(5000) });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const payload = await response.json() as ModelsResponse;
    const records = payload && Array.isArray(payload.data) ? payload.data.filter(isModel) : [];
    if (process.env.APERTURE_BRIDGE_DEBUG) console.log(`[${PROVIDER}] fetched ${records.length} models from ${BASE_URL}/models`);
    if (records.length) await writeCatalog(`${PROVIDER}-models`, records);
    return records;
  } catch (error) {
    if (process.env.APERTURE_BRIDGE_DEBUG) console.log(`[${PROVIDER}] model fetch failed; using cache: ${error}`);
    return readCatalog<ModelRecord>(`${PROVIDER}-models`, isModel);
  }
}

export default async function (pi: ExtensionAPI) {
  let state = buildModels(await fetchModels());
  if (state.models.length === 0) {
    if (process.env.APERTURE_BRIDGE_DEBUG) console.log(`[${PROVIDER}] no models found at ${BASE_URL}/models`);
    return;
  }

  pi.registerProvider(PROVIDER, {
    name: "Aperture Local Bridge"
    baseUrl: BASE_URL,
    apiKey: "-",
    authHeader: false,
    api: "openai-completions",
    models: state.models,
    async refreshModels() {
      const fresh = buildModels(await fetchModels());
      if (fresh.models.length > 0) state = fresh;
      return state.models;
    },
    streamSimple: (model, context, options) => {
      const api = state.routes.get(model.id);
      if (!api) throw new Error(`No Aperture route registered for model ${model.id}`);
      const provider = getApiProvider(api);
      if (!provider) throw new Error(`Unsupported Aperture route API: ${api}`);
      const fetchImpl = options?.fetch ?? globalThis.fetch;
      const fetchWithoutAuth: typeof fetch = (input, init) => {
        const headers = new Headers(init?.headers);
        headers.delete("authorization");
        return fetchImpl(input, { ...init, headers });
      };
      return provider.streamSimple({ ...model, api, baseUrl: routeBaseUrl(api) }, context, {
        ...options,
        fetch: fetchWithoutAuth,
      });
    },
  });
}
