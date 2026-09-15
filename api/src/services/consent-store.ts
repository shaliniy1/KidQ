import { createJsonFileStore } from "../lib/json-file-store";
import type { ConsentRecord } from "../types/consent";

const consents = createJsonFileStore<ConsentRecord>("consents.json");

// The DPDP consent text's current version. Bumping this is a deliberate,
// reviewed change (new consent copy), not something a client ever supplies —
// the backend is the only source of truth for which version was recorded.
export const CURRENT_CONSENT_VERSION = "1";

export async function getConsent(uid: string): Promise<ConsentRecord | null> {
  const all = await consents.readAll();
  return all[uid] ?? null;
}

/**
 * Records consent exactly once per account — DPDP consent is one-time, per
 * spec Section 0/P1 ("One-time, before any child profile"). If a record
 * already exists, it is returned unchanged rather than overwritten, so a
 * re-submitted consent (e.g. a retried request) never clobbers the
 * original timestamp.
 */
export async function recordConsentOnce(uid: string): Promise<ConsentRecord> {
  let result: ConsentRecord | undefined;
  await consents.write((all) => {
    if (all[uid]) {
      result = all[uid];
      return;
    }
    result = { uid, timestamp: new Date().toISOString(), version: CURRENT_CONSENT_VERSION };
    all[uid] = result;
  });
  return result!;
}
