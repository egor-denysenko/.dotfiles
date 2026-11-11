import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import contextSize from "../../dot_config/pig/agent/extensions/context-size.ts";
import stashPrompt from "../../dot_config/pig/agent/extensions/stash-prompt.ts";

function harness() {
  const events = {}, shortcuts = {}, commands = {};
  let text = "", selection;
  const notices = [], statuses = [];
  const ctx = {
    hasUI: true,
    ui: {
      getEditorText: () => text,
      setEditorText: (value) => { text = value; },
      setStatus: (...args) => statuses.push(args),
      notify: (...args) => notices.push(args),
      select: async (_title, labels) => selection?.(labels),
    },
  };
  const pi = {
    on: (name, handler) => { events[name] = handler; },
    registerShortcut: (key, value) => { shortcuts[key] = value.handler; },
    registerCommand: (name, value) => { commands[name] = value.handler; },
    getActiveTools: () => ["read"],
    getAllTools: () => [
      { name: "read", description: "Read files", parameters: { type: "object" } },
      { name: "hidden", description: "x".repeat(20000), parameters: {} },
    ],
  };
  return { pi, ctx, events, commands, shortcuts, notices, statuses,
    text: (value) => value === undefined ? text : (text = value),
    select: (callback) => { selection = callback; },
  };
}

test("startup artwork preserves PiG's native mascot header", () => {
  const source = readFileSync(new URL("../../dot_config/pig/agent/extensions/startup-banner.ts", import.meta.url), "utf8");
  assert.doesNotMatch(source, /\.setHeader\(/);
  assert.match(source, /\.setWidget\("startup-banner"/);
  assert.match(source, /registerCommand\("startup"/);
  assert.match(source, /const ART_SCRIPT = join\(__dirname, "pig-is-fine\.sh"\)/);
  const piSource = readFileSync(new URL("../../dot_config/pi/agent/extensions/startup-banner.ts", import.meta.url), "utf8");
  assert.match(piSource, /"thisisfine\.sh"/);
  assert.doesNotMatch(piSource, /pig-is-fine/);
  const settings = JSON.parse(readFileSync(new URL("../../dot_config/pig/agent/settings.json", import.meta.url), "utf8"));
  assert.equal(settings.quietStartup, false);
});

test("Ctrl+S stashes and restores multiline prompts in LIFO order", async () => {
  const h = harness(); stashPrompt(h.pi);
  h.text("first\nwith Unicode 👁"); await h.shortcuts["ctrl+s"](h.ctx);
  assert.equal(h.text(), "");
  h.text("second"); await h.shortcuts["ctrl+s"](h.ctx);
  await h.shortcuts["ctrl+s"](h.ctx); assert.equal(h.text(), "second");
  h.text(""); await h.shortcuts["ctrl+s"](h.ctx);
  assert.equal(h.text(), "first\nwith Unicode 👁");
  assert.deepEqual(h.statuses.at(-1), ["stashes", undefined]);
});

test("stash picker cancellation retains stashes; restore preserves a draft", async () => {
  const h = harness(); stashPrompt(h.pi);
  h.text("stored"); await h.shortcuts["ctrl+s"](h.ctx);
  await h.commands.stashes("", h.ctx);
  h.text("unsaved draft"); h.select((labels) => labels[0]);
  await h.commands.stashes("", h.ctx);
  assert.equal(h.text(), "stored");
  h.text(""); await h.shortcuts["ctrl+s"](h.ctx);
  assert.equal(h.text(), "unsaved draft");
});

test("context notice uses effective prompt once and only active tool schemas", () => {
  const h = harness(); contextSize(h.pi);
  const event = { systemPrompt: "Context and skills are already here" };
  h.events.before_agent_start(event, h.ctx);
  h.events.before_agent_start(event, h.ctx);
  assert.equal(h.notices.length, 1);
  assert.match(h.notices[0][0], /Active tool schemas \(1\)/);
  assert.match(h.notices[0][0], /LEAN/);
  h.events.session_start(); h.events.before_agent_start(event, h.ctx);
  assert.equal(h.notices.length, 2);
});

test("headless mode does not consume the context notice", () => {
  const h = harness(); contextSize(h.pi);
  h.ctx.hasUI = false;
  h.events.before_agent_start({ systemPrompt: "test" }, h.ctx);
  assert.equal(h.notices.length, 0);
  h.ctx.hasUI = true;
  h.events.before_agent_start({ systemPrompt: "test" }, h.ctx);
  assert.equal(h.notices.length, 1);
});
