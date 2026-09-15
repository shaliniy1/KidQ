# 03: DPDP consent gate (P1)

**What to build:** The one-time consent screen a first-time parent sees before any child
profile is created. Consent is an explicit tap, never a pre-checked box, and is persisted
with a timestamp and version so it can be proven later.

**Blocked by:** 02 (Login & first-time/returning routing)

**Status:** ready-for-agent

- [ ] Consent checkbox renders unchecked by default; Continue stays disabled until the
      parent taps it themselves.
- [ ] Voice input is not offered on this screen (tap-only, per spec — misrecognition risk
      is unacceptable on a compliance-critical step).
- [ ] On Continue, the backend Consent record store persists the account's consent
      (timestamp + version) exactly once.
- [ ] Re-visiting this screen after consent has already been recorded does not create a
      duplicate record or re-prompt — the account routes past P1 straight to P2.
- [ ] Back navigation from P1 returns to the login screen (02).
