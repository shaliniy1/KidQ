import { randomUUID } from "node:crypto";
import { createJsonFileStore } from "../lib/json-file-store";
import type { LibraryEntry } from "../types/library";

const library = createJsonFileStore<LibraryEntry>("library.json");

export async function listLibrary(uid: string): Promise<LibraryEntry[]> {
  const all = await library.readAll();
  return Object.values(all).filter((entry) => entry.uid === uid);
}

/** Skips any content already in this family's library rather than creating a duplicate entry. */
export async function addToLibrary(
  uid: string,
  entries: Omit<LibraryEntry, "id" | "uid" | "addedAt">[]
): Promise<LibraryEntry[]> {
  const created: LibraryEntry[] = [];
  await library.write((all) => {
    const now = new Date().toISOString();
    const existingContentIds = new Set(
      Object.values(all)
        .filter((entry) => entry.uid === uid)
        .map((entry) => entry.contentId)
    );
    for (const entry of entries) {
      if (existingContentIds.has(entry.contentId)) continue;
      const record: LibraryEntry = { id: randomUUID(), uid, addedAt: now, ...entry };
      all[record.id] = record;
      created.push(record);
      existingContentIds.add(entry.contentId);
    }
  });
  return created;
}
