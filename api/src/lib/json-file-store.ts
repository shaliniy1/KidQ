import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

// Same KIDQ_DATA_DIR convention as the original content-store.ts.
const dataDirectory = path.resolve(process.env.KIDQ_DATA_DIR || "data");

/**
 * A small keyed-record JSON file store: the whole file is read, mutated,
 * and rewritten under an in-process write queue so concurrent writes don't
 * race and silently drop each other. Fine for a single-process dev/
 * prototype backend with small, infrequently-written collections (accounts,
 * consents, child profiles, ...) — swap for a real DB before scaling past
 * one node or one file's worth of records.
 */
export interface JsonFileStore<T> {
  readAll(): Promise<Record<string, T>>;
  /** `mutate` edits (or replaces) the record map in place; return it, or mutate and return nothing. */
  write(mutate: (all: Record<string, T>) => Record<string, T> | void): Promise<Record<string, T>>;
}

export function createJsonFileStore<T>(filename: string): JsonFileStore<T> {
  const filePath = path.join(dataDirectory, filename);
  let writeQueue: Promise<unknown> = Promise.resolve();

  async function readAll(): Promise<Record<string, T>> {
    try {
      const raw = await readFile(filePath, "utf8");
      return JSON.parse(raw) as Record<string, T>;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return {};
      throw error;
    }
  }

  function write(mutate: (all: Record<string, T>) => Record<string, T> | void): Promise<Record<string, T>> {
    const result = writeQueue.then(async () => {
      const all = await readAll();
      const next = mutate(all) ?? all;
      await mkdir(dataDirectory, { recursive: true });
      await writeFile(filePath, JSON.stringify(next, null, 2), "utf8");
      return next;
    });
    writeQueue = result.catch(() => undefined);
    return result;
  }

  return { readAll, write };
}
