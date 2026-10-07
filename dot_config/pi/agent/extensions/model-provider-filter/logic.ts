export type ModelEntry = { provider: string; id: string };

export function providerKey(provider: string): string {
  return provider.trim().toLowerCase();
}

export function modelKey(item: ModelEntry): string {
  return `${providerKey(item.provider)}/${item.id}`;
}

export function providers(models: readonly ModelEntry[]): string[] {
  const unique = new Map<string, string>();
  for (const { provider } of models) {
    const key = providerKey(provider);
    if (key && !unique.has(key)) unique.set(key, provider.trim());
  }
  return [...unique.values()].sort((a, b) => a.localeCompare(b));
}

export function filterModels<T extends ModelEntry>(models: readonly T[], provider: string): T[] {
  const seen = new Set<string>();
  return models.filter((item) => {
    if (providerKey(item.provider) !== providerKey(provider)) return false;
    const key = modelKey(item);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function nextProvider(values: readonly string[], selected: string): string | undefined {
  if (values.length === 0) return undefined;
  const at = values.findIndex((value) => providerKey(value) === providerKey(selected));
  return values[(at + 1) % values.length];
}
