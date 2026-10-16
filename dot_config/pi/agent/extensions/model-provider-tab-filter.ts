import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { AgentSession } from "@earendil-works/pi-coding-agent";
import { ModelSelectorComponent } from "@earendil-works/pi-coding-agent";
import { getKeybindings, Spacer, Text } from "@earendil-works/pi-tui";
import { promises as fs } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { filterModels, modelKey, nextProvider, providerKey, providers } from "./model-provider-filter/logic.ts";

type ModelEntry = { provider: string; id: string };

type SelectorInstance = Record<string, unknown> & {
  activeModels?: ModelEntry[];
  filteredModels?: ModelEntry[];
  listContainer?: {
    addChild: (child: unknown) => void;
    clear: () => void;
  };
  scopedModelItems?: ModelEntry[];
  selectedIndex?: number;
  searchInput?: { getValue: () => string };
  updateList?: () => void;
  filterModels?: (query: string) => void;
  setScope?: (scope: "all" | "scoped") => void;
  scope?: "all" | "scoped";
  scopeText?: { setText: (text: string) => void };
  scopeHintText?: { setText: (text: string) => void };
  getScopeText?: () => string;
  getScopeHintText?: () => string;
  currentModel?: { provider?: string; id?: string };
};

const FILTER_ALL = "__all_providers__";
const SHIFT_TAB = "\u001b[Z";

const PERSIST_KEY = "pi-model-provider-filter";
const PERSIST_FILE = join(tmpdir(), `${PERSIST_KEY}.json`);

interface PersistedState {
  provider: string;
  timestamp: number;
}

let origSortModels: ((models: ModelEntry[]) => ModelEntry[]) | null = null;
let origLoadModelsFromSnapshot: (() => void) | null = null;
let origFilterModels: ((query: string) => void) | null = null;
let origUpdateList: (() => void) | null = null;
let origHandleInput: ((keyData: string) => void) | null = null;
let origGetScopeText: (() => string) | null = null;
let origGetScopeHintText: (() => string) | null = null;
let origCycleScopedModel: ((direction: string) => Promise<unknown>) | null = null;

let isPatched = false;
let currentSessionProvider: string | null = null;
let providerInitialization: Promise<void> | null = null;

function currentModelKey(instance: SelectorInstance): string | null {
  const provider = instance.currentModel?.provider;
  const id = instance.currentModel?.id;
  if (!provider || !id) return null;
  return modelKey({ provider, id });
}

function getProviders(instance: SelectorInstance): string[] {
  return providers(instance.activeModels ?? []);
}

function getSelectedProvider(instance: SelectorInstance): string {
  const selected = (instance as Record<string, unknown>)[PERSIST_KEY];
  return typeof selected === "string"
    ? selected
    : currentSessionProvider ?? instance.currentModel?.provider ?? FILTER_ALL;
}

function setSelectedProvider(instance: SelectorInstance, value: string): void {
  (instance as Record<string, unknown>)[PERSIST_KEY] = value;
  currentSessionProvider = value;
}

async function loadPersistedProvider(): Promise<string | null> {
  try {
    const data = await fs.readFile(PERSIST_FILE, "utf-8");
    const state = JSON.parse(data) as PersistedState;
    if (state.provider && state.provider !== FILTER_ALL) {
      return state.provider;
    }
  } catch {
    // File doesn't exist or invalid JSON
  }
  return null;
}

async function savePersistedProvider(provider: string): Promise<void> {
  try {
    await fs.writeFile(PERSIST_FILE, JSON.stringify({ provider, timestamp: Date.now() }), "utf-8");
  } catch {
    // Ignore write errors
  }
}

function applyProviderFilter(instance: SelectorInstance): void {
  const selected = getSelectedProvider(instance);
  const filtered = instance.filteredModels;
  if (!filtered) return;

  instance.filteredModels = selected === FILTER_ALL
    ? filtered
    : filterModels(filtered, selected);

  const list = instance.filteredModels;
  const current = currentModelKey(instance);
  const at = current ? list.findIndex((item) => modelKey(item) === current) : -1;
  instance.selectedIndex = at >= 0 ? at : Math.min(instance.selectedIndex ?? 0, Math.max(0, list.length - 1));

  instance.updateList?.();
}

function selectedProviderLabel(instance: SelectorInstance): string {
  const selected = getSelectedProvider(instance);
  if (selected === FILTER_ALL) return "all providers";
  return selected;
}

function refreshScopeHint(instance: SelectorInstance): void {
  const text = instance.getScopeHintText?.();
  if (text && instance.scopeHintText) {
    instance.scopeHintText.setText(text);
  }
}

function refreshScopeText(instance: SelectorInstance): void {
  const text = instance.getScopeText?.();
  if (text && instance.scopeText) {
    instance.scopeText.setText(text);
  }
}

function toggleScope(instance: SelectorInstance): void {
  if (!instance.scopedModelItems || instance.scopedModelItems.length === 0) return;
  const nextScope = instance.scope === "all" ? "scoped" : "all";
  instance.setScope?.(nextScope);
}

function cycleProvider(instance: SelectorInstance): void {
  const values = getProviders(instance);
  if (values.length <= 1) return;
  const next = nextProvider(values, getSelectedProvider(instance));
  if (!next) return;

  setSelectedProvider(instance, next);
  savePersistedProvider(next).catch(() => {});

  const query = instance.searchInput?.getValue?.() ?? "";
  instance.filterModels?.(query);
  refreshScopeText(instance);
  refreshScopeHint(instance);
}

function initializePersistedProvider(instance: SelectorInstance): Promise<void> {
  if (currentSessionProvider !== null) return Promise.resolve();
  if (providerInitialization) return providerInitialization;

  providerInitialization = (async () => {
    const available = getProviders(instance);
    const persisted = await loadPersistedProvider();
    if (currentSessionProvider !== null) return;
    const selected = available.find((value) => providerKey(value) === providerKey(persisted ?? ""))
      ?? available.find((value) => providerKey(value) === providerKey(instance.currentModel?.provider ?? ""))
      ?? available[0] ?? FILTER_ALL;
    setSelectedProvider(instance, selected);

    const query = instance.searchInput?.getValue?.() ?? "";
    instance.filterModels?.(query);
  })();
  return providerInitialization;
}

function patchModelSelector(): void {
  if (isPatched) return;

  const proto = ModelSelectorComponent.prototype as unknown as Record<string, unknown>;
  
  // Store originals only once
  origSortModels = proto.sortModels as (models: ModelEntry[]) => ModelEntry[];
  origLoadModelsFromSnapshot = proto.loadModelsFromSnapshot as () => void;
  origFilterModels = proto.filterModels as (query: string) => void;
  origUpdateList = proto.updateList as () => void;
  origHandleInput = proto.handleInput as (keyData: string) => void;
  origGetScopeText = proto.getScopeText as () => string;
  origGetScopeHintText = proto.getScopeHintText as () => string;

  proto.loadModelsFromSnapshot = function (this: SelectorInstance) {
    origLoadModelsFromSnapshot!.call(this);
    this.filterModels?.(this.searchInput?.getValue?.() ?? "");
  };

  proto.sortModels = function (this: SelectorInstance, models: ModelEntry[]) {
    const sorted = [...models];
    const current = currentModelKey(this);

    sorted.sort((a, b) => {
      const aKey = modelKey(a);
      const bKey = modelKey(b);
      const aIsCurrent = current !== null && aKey === current;
      const bIsCurrent = current !== null && bKey === current;
      if (aIsCurrent && !bIsCurrent) return -1;
      if (!aIsCurrent && bIsCurrent) return 1;

      return (
        a.provider.localeCompare(b.provider) ||
        a.id.localeCompare(b.id)
      );
    });

    return sorted;
  };

  proto.filterModels = function (this: SelectorInstance, query: string) {
    origFilterModels!.call(this, query);
    
    // Initialize persisted provider on first filter
    initializePersistedProvider(this).catch(() => {});
    
    const selected = getSelectedProvider(this);
    const allowed = getProviders(this);
    if (currentSessionProvider !== null && !allowed.some((value) => providerKey(value) === providerKey(selected))) {
      setSelectedProvider(this, allowed[0] ?? FILTER_ALL);
    }

    applyProviderFilter(this);
    refreshScopeText(this);
  };

  proto.updateList = function (this: SelectorInstance) {
    origUpdateList!.call(this);

    const selectedIndex = this.selectedIndex ?? 0;
    const selected = this.filteredModels?.[selectedIndex];
    if (!selected || !this.listContainer) return;

    // The original renderer clears and rebuilds listContainer on every update,
    // so this label must be recreated and attached on every render as well.
    this.listContainer.addChild(new Spacer(1));
    this.listContainer.addChild(new Text(`  Provider Name: ${selected.provider}`, 0, 0));
  };

  proto.getScopeText = function (this: SelectorInstance) {
    const current = selectedProviderLabel(this);
    const base = origGetScopeText ? origGetScopeText.call(this) : "Scope";
    return `${base} | Provider: ${current}`;
  };

  proto.getScopeHintText = function (this: SelectorInstance) {
    const current = selectedProviderLabel(this);
    const base = origGetScopeHintText ? origGetScopeHintText.call(this) : "Tab: scope (all/scoped)";
    return `${base} | Tab: provider (${current}) | Shift+Tab: scope`;
  };

  proto.handleInput = function (this: SelectorInstance, keyData: string) {
    const kb = getKeybindings();
    if (kb.matches(keyData, "tui.input.tab")) {
      cycleProvider(this);
      return;
    }

    if (keyData === SHIFT_TAB) {
      toggleScope(this);
      refreshScopeText(this);
      refreshScopeHint(this);
      return;
    }

    origHandleInput!.call(this, keyData);
  };

  isPatched = true;
}

function unpatchModelSelector(): void {
  if (!isPatched) return;
  const proto = ModelSelectorComponent.prototype as unknown as Record<string, unknown>;

  if (origSortModels) proto.sortModels = origSortModels;
  if (origLoadModelsFromSnapshot) proto.loadModelsFromSnapshot = origLoadModelsFromSnapshot;
  if (origFilterModels) proto.filterModels = origFilterModels;
  if (origUpdateList) proto.updateList = origUpdateList;
  if (origHandleInput) proto.handleInput = origHandleInput;
  if (origGetScopeText) proto.getScopeText = origGetScopeText;
  if (origGetScopeHintText) proto.getScopeHintText = origGetScopeHintText;

  origSortModels = null;
  origLoadModelsFromSnapshot = null;
  origFilterModels = null;
  origUpdateList = null;
  origHandleInput = null;
  origGetScopeText = null;
  origGetScopeHintText = null;
  isPatched = false;
  currentSessionProvider = null;
  providerInitialization = null;
}

type ScopedModelEntry = { model: { provider: string; id: string }; thinkingLevel?: string };

function modelFromSession(instance: Record<string, unknown>): { provider?: string; id?: string } | undefined {
  const candidateKeys = ["_model", "model", "_currentModel"];
  for (const key of candidateKeys) {
    const value = instance[key];
    if (
      value &&
      typeof value === "object" &&
      typeof (value as { provider?: unknown }).provider === "string" &&
      typeof (value as { id?: unknown }).id === "string"
    ) {
      return value as { provider: string; id: string };
    }
  }
  return undefined;
}

function isBackwardDirection(direction: string): boolean {
  const normalized = direction.toLowerCase();
  return normalized.includes("back") || normalized.includes("prev") || normalized === "-1";
}

function buildProviderRepresentatives(
  scoped: ScopedModelEntry[],
  current: { provider: string; id: string },
): ScopedModelEntry[] {
  const byProvider = new Map<string, ScopedModelEntry>();
  for (const entry of scoped) {
    if (!byProvider.has(entry.model.provider)) {
      byProvider.set(entry.model.provider, entry);
    }
  }

  if (byProvider.size <= 1) {
    return scoped;
  }

  byProvider.set(current.provider, {
    model: { provider: current.provider, id: current.id },
  });

  return [...byProvider.values()];
}

function patchCycleScopedModelByProvider(): void {
  if (origCycleScopedModel !== null) return;

  const proto = AgentSession.prototype as unknown as Record<string, unknown>;
  origCycleScopedModel = proto._cycleScopedModel as (direction: string) => Promise<unknown>;
  if (!origCycleScopedModel) return;

  proto._cycleScopedModel = async function (this: Record<string, unknown>, direction: string) {
    const scoped = this._scopedModels as ScopedModelEntry[] | undefined;
    const current = modelFromSession(this);

    if (!scoped || scoped.length <= 1 || !current?.provider || !current.id) {
      return origCycleScopedModel!.call(this, direction);
    }

    const providerSet = new Set<string>(scoped.map((entry) => entry.model.provider));
    if (providerSet.size <= 1) {
      return origCycleScopedModel!.call(this, direction);
    }

    const reps = buildProviderRepresentatives(scoped, {
      provider: current.provider,
      id: current.id,
    });

    if (reps.length <= 1) {
      return origCycleScopedModel!.call(this, direction);
    }

    const currentIndex = reps.findIndex(
      (entry) => entry.model.provider === current.provider && entry.model.id === current.id,
    );
    if (currentIndex < 0) {
      return origCycleScopedModel!.call(this, direction);
    }

    const backward = isBackwardDirection(direction);
    const ordered = backward
      ? [...reps.slice(currentIndex + 1), ...reps.slice(0, currentIndex + 1)]
      : [...reps.slice(currentIndex), ...reps.slice(0, currentIndex)];

    this._scopedModels = ordered;
    try {
      return await origCycleScopedModel!.call(this, direction);
    } finally {
      this._scopedModels = scoped;
    }
  };
}

function unpatchCycleScopedModelByProvider(): void {
  if (origCycleScopedModel === null) return;
  (AgentSession.prototype as unknown as Record<string, unknown>)._cycleScopedModel =
    origCycleScopedModel;
  origCycleScopedModel = null;
}

export default function (pi: ExtensionAPI) {
  pi.on("session_start", () => {
    patchModelSelector();
    patchCycleScopedModelByProvider();
  });

  pi.on("session_shutdown", () => {
    unpatchModelSelector();
    unpatchCycleScopedModelByProvider();
  });
}