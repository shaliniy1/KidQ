# 02: Login & first-time/returning routing (P0)

**What to build:** Google Sign-In (via Firebase Auth) as the only login method. After
sign-in, the backend tells the client whether this account has completed onboarding for
at least one child, and the client routes accordingly: first-time → P1 Consent Gate,
returning → straight to P7a Start a Session.

**Blocked by:** 01 (App shell, design tokens & config source-of-truth)

**Status:** ready-for-agent

- [ ] Google Sign-In button using Firebase Auth OAuth; no email/password option.
- [ ] One shared Google account per family — no per-caregiver identity is created; any
      caregiver signing in with the same Google account reaches the same family data.
- [ ] Backend Authentication component checks onboarding completion for the signed-in
      account and returns a routing flag.
- [ ] Client shows a loading state until the routing flag returns, then routes: no prior
      onboarding → P1; onboarding already done → P7a (P7a itself is built in ticket 07;
      this ticket only needs the routing target to exist as a stub route).
- [ ] Consent record store and Child profile store are not required yet — this ticket only
      covers the auth handshake and routing decision.
