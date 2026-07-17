import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { AgentSession } from "@earendil-works/pi-coding-agent";
import { ModelSelectorComponent } from "@earendil-works/pi-coding-agent";
import { getKeybindings, Spacer, Text } from "@earendil-works/pi-tui";

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

const FILTER_KEY = "__provider_filter";
const PROVIDERS_KEY = "__provider_values";

let origSortModels: ((models: ModelEntry[]) => ModelEntry[]) | null = null;
let origFilterModels: ((query: string) => void) | null = null;
let origUpdateList: (() => void) | null = null;
let origHandleInput: ((keyData: string) => void) | null = null;
let origGetScopeText: (() => string) | null = null;
let origGetScopeHintText: (() => string) | null = null;
let origCycleScopedModel: ((direction: string) => Promise<unknown>) | null = null;

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
  const selected = (instance as Record<string, unknown>)[FILTER_KEY];
  return typeof selected === "string" ? selected : FILTER_ALL;
}

function setSelectedProvider(instance: SelectorInstance, value: string): void {
  (instance as Record<string, unknown>)[FILTER_KEY] = value;
}

function setProviderValues(instance: SelectorInstance, values: string[]): void {
  (instance as Record<string, unknown>)[PROVIDERS_KEY] = values;
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
  setProviderValues(instance, values);

  const selected = getSelectedProvider(instance);
  const at = Math.max(0, values.indexOf(selected));
  const next = (at + direction + values.length) % values.length;
  setSelectedProvider(instance, values[next] ?? FILTER_ALL);

  const query = instance.searchInput?.getValue?.() ?? "";
  instance.filterModels?.(query);
  refreshScopeText(instance);
  refreshScopeHint(instance);
}

function patchModelSelector(): void {
  if (origHandleInput !== null) return;

  const proto = ModelSelectorComponent.prototype as unknown as Record<string, unknown>;
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
    setProviderValues(this, getProviders(this));

    const selected = getSelectedProvider(this);
    const allowed = ((this as Record<string, unknown>)[PROVIDERS_KEY] as string[] | undefined) ?? [FILTER_ALL];
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
}

function unpatchModelSelector(): void {
  if (origHandleInput === null) return;
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

    const providerSet = new Set(scoped.map((entry) => entry.model.provider));
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
