import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";

const script = fileURLToPath(new URL("../../dot_config/pig/agent/extensions/executable_pig-is-fine.sh", import.meta.url));
const render = (args = [], env = {}) => spawnSync("sh", [script, ...args], {
  encoding: "utf8",
  env: { ...process.env, ...env },
});
const stripColor = (text) => text.replace(/\x1b\[[0-9;]*m/g, "");

test("sheriff pig renders a 45 by 25 half-block image like thisisfine.sh", () => {
  const result = render(["--no-color"]);
  assert.equal(result.status, 0, result.stderr);
  assert.doesNotMatch(result.stdout, /[^ ▀▄█\n]/);
  assert.match(result.stdout, /[▀▄█]/);
  const lines = result.stdout.slice(0, -1).split("\n");
  assert.equal(lines.length, 25);
  assert.ok(lines.every((line) => line.length === 45));
});

test("forced color preserves the drawing and resets every line", () => {
  const plain = render(["--no-color"]).stdout;
  const colored = render(["--color"]);
  assert.equal(colored.status, 0, colored.stderr);
  assert.match(colored.stdout, /\x1b\[38;2;/);
  // Monochrome uses full blocks where both pixels are occupied. Color uses
  // foreground/background colors on a half block to preserve interior detail.
  const occupancy = (text) => stripColor(text).replace(/[▀▄█]/g, "#");
  assert.equal(occupancy(colored.stdout), occupancy(plain));
  assert.ok(colored.stdout.trimEnd().split("\n").every((line) => line.endsWith("\x1b[0m")));
});

test("NO_COLOR suppresses ANSI; --color overrides it for UI capture", () => {
  assert.doesNotMatch(render([], { NO_COLOR: "1" }).stdout, /\x1b/);
  assert.match(render(["--color"], { NO_COLOR: "1" }).stdout, /\x1b\[38;2;/);
});

test("help succeeds and invalid arguments fail", () => {
  const help = render(["--help"]);
  assert.equal(help.status, 0);
  assert.match(help.stdout, /Usage:/);
  assert.equal(render(["--unknown"]).status, 2);
  assert.equal(render(["--color", "extra"]).status, 2);
});
