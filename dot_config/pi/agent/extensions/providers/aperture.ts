/**
 * Aperture provider — Tailscale AI gateway.
 *
 * Supports per-model API routing (openai/anthropic/bedrock) so dedicated
 * models can use their required wire protocol.
 */
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

const GATEWAY_URL = "http://ai-gateway.tail692491.ts.net";
const BASE_URL = `${GATEWAY_URL}/v1`;

type ProviderCompatibility = {
  openai_chat?: boolean;
  openai_responses?: boolean;
  anthropic_messages?: boolean;
  bedrock_converse?: boolean;
  gemini_generate_content?: boolean;
  google_generate_content?: boolean;
};

type ApertureProvider = {
  id: string;
  name: string;
  models: string[];
  compatibility?: ProviderCompatibility;
};

type ApiRoute =
  | "openai-completions"
  | "openai-responses"
  | "anthropic-messages"
  | "bedrock-converse-stream"
  | "google-generative-ai"
  | "google-vertex";

function getApiForCompatibility(compatibility?: ProviderCompatibility): ApiRoute {
  if (!compatibility) return "openai-completions";
  if (compatibility.anthropic_messages) return "anthropic-messages";
  if (compatibility.bedrock_converse) return "bedrock-converse-stream";
  if (compatibility.openai_responses) return "openai-responses";
  if (compatibility.openai_chat) return "openai-completions";
  if (compatibility.gemini_generate_content) return "google-generative-ai";
  if (compatibility.google_generate_content) return "google-vertex";
  return "openai-completions";
}

function getBaseUrlForApi(api: ApiRoute): string {
  switch (api) {
    case "anthropic-messages":
      return GATEWAY_URL;
    case "bedrock-converse-stream":
      // Aperture exposes Bedrock-compatible routes under /bedrock/model/...,
      // not under /v1/model/...
      return `${GATEWAY_URL}/bedrock`;
    case "google-generative-ai":
      return `${GATEWAY_URL}/v1beta`;
    case "google-vertex":
      return `${GATEWAY_URL}/v1`;
    default:
      return BASE_URL;
  }
}

async function fetchProviders(): Promise<ApertureProvider[]> {
  try {
    const res = await fetch(`${GATEWAY_URL}/api/providers`, {
      signal: AbortSignal.timeout(1500),
    });
    if (!res.ok) return [];
    const payload = (await res.json()) as unknown;
    return Array.isArray(payload) ? (payload as ApertureProvider[]) : [];
  } catch {
    return [];
  }
}

export default async function (pi: ExtensionAPI) {
  let providers: ApertureProvider[];
  try {
    providers = await fetchProviders();
  } catch {
    return;
  }

  if (providers.length === 0) return;

  const models = [] as Array<{
    id: string;
    name: string;
    reasoning: boolean;
    input: ("text" | "image")[];
    cost: { input: number; output: number; cacheRead: number; cacheWrite: number };
    contextWindow: number;
    maxTokens: number;
    api: ApiRoute;
    baseUrl: string;
  }>;

  for (const provider of providers) {
    const api = getApiForCompatibility(provider.compatibility);
    for (const id of provider.models ?? []) {
      if (!id) continue;
      models.push({
        id,
        name: id,
        reasoning: false,
        input: ["text"],
        cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
        contextWindow: 128000,
        maxTokens: 8192,
        api,
        baseUrl: getBaseUrlForApi(api),
      });
    }
  }

  if (models.length === 0) return;

  pi.registerProvider("aperture", {
    name: "Aperture (Tailscale)",
    baseUrl: BASE_URL,
    apiKey: "-",
    authHeader: false,
    models,
  });
}
