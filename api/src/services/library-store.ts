import { randomUUID } from "node:crypto";
import { createJsonFileStore } from "../lib/json-file-store";
import type { LibraryEntry, SubmissionStatus } from "../types/library";

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

export async function removeFromLibrary(uid: string, entryId: string): Promise<boolean> {
  let removed = false;
  await library.write((all) => {
    const existing = all[entryId];
    if (!existing || existing.uid !== uid) return;
    delete all[entryId];
    removed = true;
  });
  return removed;
}

export async function setSubmissionStatus(entryId: string, status: SubmissionStatus): Promise<LibraryEntry | null> {
  let result: LibraryEntry | null = null;
  await library.write((all) => {
    const existing = all[entryId];
    if (!existing) return;
    result = { ...existing, submissionStatus: status };
    all[entryId] = result;
  });
  return result;
}

export async function getLibraryEntry(uid: string, entryId: string): Promise<LibraryEntry | null> {
  const all = await library.readAll();
  const entry = all[entryId];
  return entry && entry.uid === uid ? entry : null;
}
