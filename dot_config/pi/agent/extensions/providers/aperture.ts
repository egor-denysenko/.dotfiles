/**
 * Aperture provider — Tailscale AI gateway.
 *
 * Supports per-model API routing (openai/anthropic/bedrock) so dedicated
 * models can use their required wire protocol.
 */
import { getApiProvider } from "@earendil-works/pi-ai";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { readCatalog, writeCatalog } from "./catalog-cache";

const GATEWAY_URL = "http://ai-gateway.tail692491.ts.net";
const BASE_URL = `${GATEWAY_URL}/v1`;

type ApertureModel = {
  id?: unknown;
  display_name?: unknown;
  supported_endpoints?: unknown;
  pricing?: Record<string, unknown>;
  context_window_tokens?: unknown;
  max_output_tokens?: unknown;
  reasoning?: unknown;
  supports_reasoning?: unknown;
  input_modalities?: unknown;
};

type ModelsResponse = {
  data?: unknown;
};

type ApiRoute =
  | "openai-completions"
  | "openai-responses"
  | "anthropic-messages"
  | "bedrock-converse-stream";

function getBaseUrlForApi(api: ApiRoute): string {
  switch (api) {
    case "anthropic-messages":
      return GATEWAY_URL;
    case "bedrock-converse-stream":
      // Aperture exposes Bedrock-compatible routes under /bedrock/model/...,
      // not under /v1/model/...
      return `${GATEWAY_URL}/bedrock`;
    default:
      return BASE_URL;
  }
}

function asPositiveNumber(value: unknown, fallback: number): number {
  const number = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  return Number.isFinite(number) && number > 0 ? number : fallback;
}

function isApertureModel(value: unknown): value is ApertureModel {
  return Boolean(value && typeof value === "object" && typeof (value as ApertureModel).id === "string");
}

function log(message: string): void {
  if (process.env.APERTURE_DEBUG) console.log(`[aperture] ${message}`);
}

function apiForEndpoints(endpoints: unknown): ApiRoute | undefined {
  if (!Array.isArray(endpoints)) return;
  if (endpoints.includes("/v1/responses")) return "openai-responses";
  if (endpoints.includes("/v1/chat/completions")) return "openai-completions";
  if (endpoints.includes("/bedrock/model/{model}/converse-stream")) {
    return "bedrock-converse-stream";
  }
}

async function fetchModels(): Promise<ApertureModel[]> {
  try {
    // The public model catalog includes routing and pricing metadata. Keep a
    // local copy so a temporary gateway outage does not unregister Aperture.
    const res = await fetch(`${BASE_URL}/models`, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const payload = (await res.json()) as ModelsResponse;
    const catalog = Array.isArray(payload.data) ? (payload.data as ApertureModel[]) : [];
    if (catalog.length > 0) await writeCatalog("aperture-models", catalog);
    return catalog;
  } catch {
    log("gateway unavailable; using cached model catalog");
    return readCatalog<ApertureModel>("aperture-models", isApertureModel);
  }
}

function modelInput(value: unknown): ("text" | "image")[] {
  if (!Array.isArray(value)) return ["text"];
  const input = value.filter((item): item is "text" | "image" => item === "text" || item === "image");
  return input.length > 0 ? [...new Set(input)] : ["text"];
}

function modelCost(pricing: Record<string, unknown> | undefined) {
  const price = (key: string) => {
    const value = pricing?.[key];
    const number = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
    return Number.isFinite(number) && number >= 0 ? number * 1_000_000 : 0;
  };
  return {
    input: price("input"),
    output: price("output"),
    cacheRead: price("input_cache_read"),
    cacheWrite: price("input_cache_write"),
  };
}

type RegisteredModel = {
  id: string;
  name: string;
  reasoning: boolean;
  input: ("text" | "image")[];
  cost: { input: number; output: number; cacheRead: number; cacheWrite: number };
  contextWindow: number;
  maxTokens: number;
  api: "aperture";
  baseUrl: string;
};

type BuiltCatalog = {
  models: RegisteredModel[];
  routes: Map<string, ApiRoute>;
};

function buildCatalog(catalog: ApertureModel[]): BuiltCatalog {
  const routes = new Map<string, ApiRoute>();
  const models = catalog.flatMap((entry) => {
    const id = typeof entry.id === "string" ? entry.id : "";
    const api = apiForEndpoints(entry.supported_endpoints);
    if (!id || !api) {
      log(`skipping ${id || "unnamed model"}: unsupported Aperture endpoint metadata`);
      return [];
    }
    if (routes.has(id)) {
      log(`skipping duplicate Aperture model id: ${id}`);
      return [];
    }

    routes.set(id, api);
    return [{
      id,
      name: typeof entry.display_name === "string" ? entry.display_name : id,
      reasoning: entry.reasoning === true || entry.supports_reasoning === true,
      input: modelInput(entry.input_modalities),
      cost: modelCost(entry.pricing),
      contextWindow: asPositiveNumber(entry.context_window_tokens, 128000),
      maxTokens: asPositiveNumber(entry.max_output_tokens, 8192),
      api: "aperture" as const,
      baseUrl: getBaseUrlForApi(api),
    }];
  });
  return { models, routes };
}

export default async function (pi: ExtensionAPI) {
  const catalog = await fetchModels();
  if (catalog.length === 0) return;

  let state = buildCatalog(catalog);
  if (state.models.length === 0) return;

  pi.registerProvider("aperture", {
    name: "Aperture (Tailscale)",
    baseUrl: BASE_URL,
    apiKey: "-",
    api: "aperture",
    models: state.models,
    async refreshModels() {
      const freshCatalog = await fetchModels();
      if (freshCatalog.length === 0) return state.models;
      const next = buildCatalog(freshCatalog);
      if (next.models.length === 0) return state.models;
      state = next;
      return next.models;
    },
    streamSimple: (model, context, options) => {
      const api = state.routes.get(model.id);
      if (!api) throw new Error(`No Aperture route registered for model ${model.id}`);
      const provider = getApiProvider(api);
      if (!provider) throw new Error(`Unsupported Aperture route API: ${api}`);

      // Aperture authenticates through Tailscale. Pi otherwise injects the
      // placeholder apiKey as a Bearer token, which Aperture rejects.
      const headers = { ...options?.headers };
      delete headers.Authorization;
      delete headers.authorization;
      return provider.streamSimple({ ...model, api }, context, { ...options, headers });
    },
  });
}
