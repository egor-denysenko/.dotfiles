import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

import apertureBridge from "./aperture-bridge";
import litellm from "./litellm";
import unsloth from "./unsloth";

export default async function (pi: ExtensionAPI) {
  await Promise.all([litellm(pi), apertureBridge(pi), unsloth(pi)]);
}
