import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

const CACHE_DIR = join(homedir(), ".cache", "pi", "agent");
const CACHE_VERSION = 1;

type CacheFile<T> = {
  version: number;
  writtenAt: string;
  data: T[];
};

export async function readCatalog<T>(
  name: string,
  isItem: (value: unknown) => value is T,
): Promise<T[]> {
  try {
    const raw = await readFile(join(CACHE_DIR, `${name}.json`), "utf-8");
    const parsed: unknown = JSON.parse(raw);
    const data = Array.isArray(parsed)
      ? parsed
      : parsed && typeof parsed === "object" &&
          (parsed as Partial<CacheFile<unknown>>).version === CACHE_VERSION &&
          "data" in parsed
        ? (parsed as Partial<CacheFile<unknown>>).data
        : undefined;

    if (!Array.isArray(data)) return [];
    return data.filter(isItem);
  } catch {
    return [];
  }
}

export async function writeCatalog<T>(name: string, catalog: T[]): Promise<void> {
  try {
    await mkdir(CACHE_DIR, { recursive: true });
    const path = join(CACHE_DIR, `${name}.json`);
    const temporaryPath = `${path}.${process.pid}.tmp`;
    const payload: CacheFile<T> = {
      version: CACHE_VERSION,
      writtenAt: new Date().toISOString(),
      data: catalog,
    };
    await writeFile(temporaryPath, JSON.stringify(payload), { encoding: "utf-8", mode: 0o600 });
    await rename(temporaryPath, path);
  } catch {
    // The cache is an optimization; provider registration must not fail if it cannot be written.
  }
}
