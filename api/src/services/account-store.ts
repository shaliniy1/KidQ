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
    result = { uid, email, parentName: null, createdAt: new Date().toISOString(), onboardingComplete: false };
    all[uid] = result;
  });
  return result!;
}

/**
 * Saves the parent's name and marks onboarding complete, in one write.
 * Called once, when P2 Screen 1 (ticket 04) saves the first child profile —
 * this is what actually flips the Section 0 routing flag from false to true.
 */
export async function completeOnboarding(uid: string, parentName: string): Promise<AccountRecord> {
  let result: AccountRecord | undefined;
  await accounts.write((all) => {
    const existing = all[uid];
    if (!existing) throw new Error(`No account found for uid ${uid}`);
    result = { ...existing, parentName, onboardingComplete: true };
    all[uid] = result;
  });
  return result!;
}
