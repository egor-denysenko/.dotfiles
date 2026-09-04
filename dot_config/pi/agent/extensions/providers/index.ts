import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

import aperture from "./aperture";
import litellm from "./litellm";
import unsloth from "./unsloth";

export default async function (pi: ExtensionAPI) {
  await Promise.all([litellm(pi), aperture(pi), unsloth(pi)]);
}
