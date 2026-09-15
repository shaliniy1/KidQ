// There is no real DPDP-consent endpoint on the API today — this is a
// documented gap (see INTEGRATION_NOTES.md's auth section for the related
// discussion). Consent is recorded locally on this device only, which is
// NOT a substitute for a real, server-recorded consent decision; treat this
// as a placeholder until the API grows a real /consent (or equivalent)
// contract to record it against the parent's account.
const CONSENT_KEY = "kidq-web-dpdp-consent";

export interface ConsentStatusResponse {
  hasConsented: boolean;
}

export async function getConsentStatus(): Promise<ConsentStatusResponse> {
  try {
    return { hasConsented: window.localStorage.getItem(CONSENT_KEY) === "true" };
  } catch {
    return { hasConsented: false };
  }
}

export async function recordConsent(): Promise<void> {
  try {
    window.localStorage.setItem(CONSENT_KEY, "true");
  } catch {
    // Storage may be blocked — the consent screen will just ask again next time.
  }
}
