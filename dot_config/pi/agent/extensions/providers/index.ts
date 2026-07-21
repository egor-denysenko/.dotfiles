import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

import litellm from "./litellm";
import lmstudio from "./lmstudio";

export default async function (pi: ExtensionAPI) {
  await Promise.all([litellm(pi), lmstudio(pi)]);
}
