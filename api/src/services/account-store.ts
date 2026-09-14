import { createJsonFileStore } from "../lib/json-file-store";
import type { AccountRecord } from "../types/account";

const accounts = createJsonFileStore<AccountRecord>("accounts.json");

/**
 * Looks up the account for a Firebase UID, creating it (onboardingComplete:
 * false) on first sign-in. Returns the record either way, so the caller
 * always has a routing-flag source.
 */
export async function getOrCreateAccount(uid: string, email: string | null): Promise<AccountRecord> {
  let result: AccountRecord | undefined;
  await accounts.write((all) => {
    if (all[uid]) {
      result = all[uid];
      return;
    }
    result = { uid, email, createdAt: new Date().toISOString(), onboardingComplete: false };
    all[uid] = result;
  });
  return result!;
}

/** Called by the Child profile store (ticket 04) once the first child profile is saved. */
export async function markOnboardingComplete(uid: string): Promise<void> {
  await accounts.write((all) => {
    const existing = all[uid];
    if (!existing) throw new Error(`No account found for uid ${uid}`);
    all[uid] = { ...existing, onboardingComplete: true };
  });
}
