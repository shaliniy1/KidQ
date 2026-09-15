# 16: Known gaps carried from T01–T04 (tracking only)

**What to build:** Nothing yet — this ticket exists so three known gaps surfaced while
building T01–T04 stay visible instead of getting lost in commit messages. Each needs a
real decision or a real external resource before it can be closed; none block the
tickets that follow.

**Blocked by:** None (tracking ticket, not a build task)

**Status:** ready-for-agent (triage/decision needed before work starts)

- [ ] **T02 — Google Sign-In is untested end-to-end.** Built against env-var placeholders
      (`FIREBASE_PROJECT_ID`/`FIREBASE_CLIENT_EMAIL`/`FIREBASE_PRIVATE_KEY` server-side,
      `NEXT_PUBLIC_FIREBASE_*` client-side — see `api/.env.example`, `web/.env.example`),
      per your explicit choice to proceed without a real Firebase project. The backend
      correctly 501s with a clear "not configured" message rather than faking auth, and
      the login screen's redirect/guard logic is verified — but real Google OAuth and the
      resulting onboarding-routing decision have never run against a live account. Needs:
      a real Firebase project's credentials dropped into those env files, then a live
      click-through.
- [ ] **T04 — age-band vs. birthdate mismatch.** Spec Section 11 #10 promises silent
      age-band re-derivation when a child's actual age crosses a band boundary, but
      Section 1 only ever captures a coarse band (0-2/2-3/.../5-6), never a birthdate —
      there's no continuous signal to detect a crossing from. Each child profile now
      records `ageBandAssignedAt` (see `api/src/types/child-profile.ts`) so a future
      birthdate-capture or estimation policy has something to compute from, but no
      re-derivation logic exists yet. Needs: a product decision — capture an actual
      birthdate instead of/alongside the band, or define an explicit estimation policy
      (e.g. assume mid-band, re-check after N months) — before this can be built.
- [ ] **T01 — "lavender" mascot color has no real design token.** The spec names 5 brand
      accents for mascot colors including lavender, but `kidq-design-tokens.css` only
      defines solid brand colors for teal/saffron/terracotta/mango — lavender only exists
      as a pastel card background (`--kq-card-lavender`, meant for category card fills) or
      the deeper `--kq-dusk-lavender` (night/wind-down palette). `web/src/lib/mascot-colors.ts`
      currently maps mascot "lavender" to `--kq-dusk-lavender` as a reasonable stand-in
      (documented in that file), but this is a workaround, not a confirmed design decision.
      Needs: design sign-off on a real solid brand-lavender token, or confirmation that
      `--kq-dusk-lavender` is the intended value.
