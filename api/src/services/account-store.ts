import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { AccountRecord } from "../types/account";

// Same KIDQ_DATA_DIR convention as content-store.ts.
const dataDirectory = path.resolve(process.env.KIDQ_DATA_DIR || "data");
const accountsFile = path.join(dataDirectory, "accounts.json");

async function readAll(): Promise<Record<string, AccountRecord>> {
  try {
    const raw = await readFile(accountsFile, "utf8");
    return JSON.parse(raw) as Record<string, AccountRecord>;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return {};
    throw error;
  }
}

async function writeAll(accounts: Record<string, AccountRecord>) {
  await mkdir(dataDirectory, { recursive: true });
  await writeFile(accountsFile, JSON.stringify(accounts, null, 2), "utf8");
}

// Simple in-process write queue: this is a small file rewritten wholesale on
// every write, so concurrent writes must be serialized or the last one wins
// and silently drops the other. A single-process dev/prototype backend does
// not need more than this; swap for a real DB before scaling past one node.
let writeQueue: Promise<unknown> = Promise.resolve();
function enqueueWrite<T>(fn: () => Promise<T>): Promise<T> {
  const result = writeQueue.then(fn, fn);
  writeQueue = result.catch(() => undefined);
  return result;
}

/**
 * Looks up the account for a Firebase UID, creating it (onboardingComplete:
 * false) on first sign-in. Returns the record either way, so the caller
 * always has a routing-flag source.
 */
export async function getOrCreateAccount(uid: string, email: string | null): Promise<AccountRecord> {
  return enqueueWrite(async () => {
    const accounts = await readAll();
    const existing = accounts[uid];
    if (existing) return existing;

    const created: AccountRecord = {
      uid,
      email,
      createdAt: new Date().toISOString(),
      onboardingComplete: false,
    };
    accounts[uid] = created;
    await writeAll(accounts);
    return created;
  });
}

/** Called by the Child profile store (ticket 04) once the first child profile is saved. */
export async function markOnboardingComplete(uid: string): Promise<void> {
  return enqueueWrite(async () => {
    const accounts = await readAll();
    const existing = accounts[uid];
    if (!existing) throw new Error(`No account found for uid ${uid}`);
    accounts[uid] = { ...existing, onboardingComplete: true };
    await writeAll(accounts);
  });
}
