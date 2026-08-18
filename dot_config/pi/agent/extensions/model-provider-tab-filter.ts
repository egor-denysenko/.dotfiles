import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { AgentSession } from "@earendil-works/pi-coding-agent";
import { ModelSelectorComponent } from "@earendil-works/pi-coding-agent";
import { getKeybindings, Spacer, Text } from "@earendil-works/pi-tui";
import { promises as fs } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

type ModelEntry = {
  provider: string;
  id: string;
  model?: {
    name?: string;
  };
};

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
let origFilterModels: ((query: string) => void) | null = null;
let origUpdateList: (() => void) | null = null;
let origHandleInput: ((keyData: string) => void) | null = null;
let origGetScopeText: (() => string) | null = null;
let origGetScopeHintText: (() => string) | null = null;
let origCycleScopedModel: ((direction: string) => Promise<unknown>) | null = null;

let isPatched = false;
let currentSessionProvider: string | null = null;

function modelKey(item: { provider: string; id: string }): string {
  return `${item.provider}/${item.id}`;
}

function currentModelKey(instance: SelectorInstance): string | null {
  const provider = instance.currentModel?.provider;
  const id = instance.currentModel?.id;
  if (!provider || !id) return null;
  return `${provider}/${id}`;
}

function getProviders(instance: SelectorInstance): string[] {
  const source = instance.activeModels ?? [];
  const values = [...new Set(source.map((item) => item.provider))].sort((a, b) => a.localeCompare(b));
  return [FILTER_ALL, ...values];
}

function getSelectedProvider(instance: SelectorInstance): string {
  const selected = (instance as Record<string, unknown>)[PERSIST_KEY];
  return typeof selected === "string" ? selected : FILTER_ALL;
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

  if (selected !== FILTER_ALL) {
    instance.filteredModels = filtered.filter((item) => item.provider === selected);
  }

  const list = instance.filteredModels ?? [];
  if (list.length === 0) {
    instance.selectedIndex = 0;
  } else {
    const current = currentModelKey(instance);
    if (current) {
      const at = list.findIndex((item) => modelKey(item) === current);
      if (at >= 0) {
        instance.selectedIndex = at;
      } else {
        const existing = instance.selectedIndex ?? 0;
        instance.selectedIndex = Math.min(existing, list.length - 1);
      }
    } else {
      const existing = instance.selectedIndex ?? 0;
      instance.selectedIndex = Math.min(existing, list.length - 1);
    }
  }

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

function cycleProvider(instance: SelectorInstance, direction: 1 | -1): void {
  const values = getProviders(instance);
  const selected = getSelectedProvider(instance);
  const at = Math.max(0, values.indexOf(selected));
  const next = (at + direction + values.length) % values.length;
  const nextProvider = values[next] ?? FILTER_ALL;
  
  setSelectedProvider(instance, nextProvider);
  
  // Persist the selection
  savePersistedProvider(nextProvider).catch(() => {});

  const query = instance.searchInput?.getValue?.() ?? "";
  instance.filterModels?.(query);
  refreshScopeText(instance);
  refreshScopeHint(instance);
}

async function initializePersistedProvider(instance: SelectorInstance): Promise<void> {
  if (currentSessionProvider !== null) return; // Already initialized this session
  
  const persisted = await loadPersistedProvider();
  if (persisted) {
    const available = getProviders(instance);
    if (available.includes(persisted)) {
      setSelectedProvider(instance, persisted);
      currentSessionProvider = persisted;
      return;
    }
  }
  // Default to all providers
  currentSessionProvider = FILTER_ALL;
}

function patchModelSelector(): void {
  if (isPatched) return;

  const proto = ModelSelectorComponent.prototype as unknown as Record<string, unknown>;
  
  // Store originals only once
  origSortModels = proto.sortModels as (models: ModelEntry[]) => ModelEntry[];
  origFilterModels = proto.filterModels as (query: string) => void;
  origUpdateList = proto.updateList as () => void;
  origHandleInput = proto.handleInput as (keyData: string) => void;
  origGetScopeText = proto.getScopeText as () => string;
  origGetScopeHintText = proto.getScopeHintText as () => string;

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
    if (!allowed.includes(selected)) {
      setSelectedProvider(this, FILTER_ALL);
    }

    applyProviderFilter(this);
    refreshScopeText(this);
  };

  proto.updateList = function (this: SelectorInstance) {
    origUpdateList!.call(this);

    const selectedIndex = this.selectedIndex ?? 0;
    const selected = this.filteredModels?.[selectedIndex];
    if (!selected || !this.listContainer) return;

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
      cycleProvider(this, 1);
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
  if (origFilterModels) proto.filterModels = origFilterModels;
  if (origUpdateList) proto.updateList = origUpdateList;
  if (origHandleInput) proto.handleInput = origHandleInput;
  if (origGetScopeText) proto.getScopeText = origGetScopeText;
  if (origGetScopeHintText) proto.getScopeHintText = origGetScopeHintText;

  origSortModels = null;
  origFilterModels = null;
  origUpdateList = null;
  origHandleInput = null;
  origGetScopeText = null;
  origGetScopeHintText = null;
  isPatched = false;
  currentSessionProvider = null;
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