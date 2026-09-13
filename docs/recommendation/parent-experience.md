# KidQ Parent Experience

The parent-experience spec as Shalini shared it on 2026-09-13, below, with **KidQ's decisions of the same day**. Where they differ, the decisions win:

- **Who sees what**: a parent sees a video in recommendations once an admin approves it and it matches the child's age band and chosen options. A child sees only what their parent added to that child's library. Sessions draw from the child's library, never from recommendations.
- **Parent-added videos stay admin-approved** before any child sees them (§7's "Private, usable immediately" isn't adopted). The Private/Public switch only decides whether an approved video is also suggested to other families.
- **Thin library** (§2 rule 6): no neighbouring-age-band fallback. A session is as long as the child's library allows, and the parent is told factually afterwards.
- **Login** (§0, §9): Google Sign-In through Supabase Auth, not Firebase.
- **No expert reviews** anywhere (§2 rule 2, §9): removed from KidQ.
- **AI scoring**: every item is scored once and keeps its score.
- **Build order**: sessions and the watch log; consent, mascot colour, settings and per-child blocking; My Videos, 👍/👎 and notifications; analytics and the pool monitor (`GET /content-pool`, built); voice.

---

# KidQ Parent Experience — Consolidated Spec

Merges and supersedes `KidQ_Parent_Onboarding_Field_Spec.md` and `KidQ_Session_Assembly_Rules.md`. Adds: session duration/tolerance, recurring session handoff, session-complete notification, analytics, My Videos, voice input, and the backend/API surface all of the above requires.

---

## 0. Screen inventory — what exists, what's new, what's still open

| # | Screen | Status | Notes |
|---|---|---|---|
| P1 | DPDP Consent Gate | existing | One-time, before any child profile. Unchanged. Tap-only — see Section 8. |
| P2 | Child Profile & Preferences | **revised** | Section 1 below. Screens 1–7 **mocked**. |
| P3 | Onboarding Path (3 doors) | existing | Talk/type, guided questions, browse. Voice detailed in Section 8. |
| P4 | Review AI Suggestions | existing | AI-guided path only. Voice retry loop detailed in Section 8. |
| P5 | Recommendation Screen | existing | Unchanged, not mocked. |
| P6 | Kid View Preview | existing | Unchanged, not mocked. |
| P7 | Settings | **revised** | Rarely-changed defaults: schedule, autoplay, break type, sensory — now field-level specified, see Section 11 #7. |
| P7a | **Start a Session** | **new** | Section 4. The everyday quick action — not the same screen as P7 Settings. Voice-enabled (Section 8). |
| P8 | Handoff & Insight Tray | existing | Factual watched-content log + 👍/👎. Extended by P8a/P8b below. |
| P8a | **Session-Complete Notification** | **new** | Section 5. |
| P8b | **Analytics / Insight Dashboard** | **new** | Section 6. |
| P9 | My Videos | existing (conceptual) | Elaborated with concrete screens in Section 7. |
| P9a | **Add a Video (paste URL)** | **new** | Section 7. |
| P9b | **Submission Approved notification** | **new** | Section 7. |
| — | Child Player / Breakpoint / Wind-Down Close | existing | Unchanged screens; gains one business-logic note in Section 4 (session starts live on handoff). |
| — | Kid-to-parent reaction sharing ("share with Mumma") | **deferred** | You flagged this yourself as a later feature. Not designed here. |
| — | Multiple duration/curation profiles (bedtime / daytime / holiday mixes) | **deferred to phase 2** | See Section 4. |

### Login & entry routing

- **P0 — Login.** Google Sign-In only (OAuth via Firebase Auth) — no email/password, no custom domain required, free under Firebase's no-cost tier and Google's unverified-app allowance. **One Google account per family.** Every caregiver in the household signs in with that same account — e.g. if the account was created with the mother's Google login, the father signs into KidQ using that same Google account on his own phone, not one of his own. (Separate login identities for multiple caregivers sharing one household are deferred to phase 2 — see Section 10 backend note.)
- **Routing after login — has this account completed onboarding for at least one child?**
  - **No → first-time flow.** Lands on **P1 DPDP Consent Gate**, then the full chain below through P6, ending at P7a.
  - **Yes → returning-parent flow.** Skips onboarding entirely, lands directly on **P7a Start a Session** — see Section 4.

---

## 1. Parent Onboarding Field Spec (P2 revision)

Design principle: only two fields per child are ever mandatory. Everything else defaults from age and is reachable through one "Customize" expansion.

### Screen 1 — Mandatory (cannot skip)

```
Parent name
Number of children          [stepper, 1-6, default 1]

Per child (repeat for count above):
  Child's nickname            [free text — nickname only, never legal name, per DPDP minimization already in P1]
  Child's age                 [single picker: 0-2 / 2-3 / 3-4 / 4-5 / 5-6 — same bands Admin uses to tag content]
```

### Mascot color (per child, optional)
Each child also gets a mascot/avatar color — auto-assigned by default, cycling through KidQ's 5 existing brand accent colors (teal, saffron, terracotta, mango, lavender) in the order children are added — changeable with one tap on Screen 1. Purely a visual differentiator for multi-child households (used on the child-switcher in Sections 4 and 6); not tied to gender by the system itself — parents may use it however they like.

### Screen 2 — Default confirmation

**Copy:** "We've set up [Child]'s KidQ using just their age. Start right away, or fine-tune it below."
**Actions:** `[ Start using KidQ ]` (primary) → skips to P3 · `[ Customize for {child} ]` (secondary) → expands Blocks A, B, D, E.

### Optional Block A — Interests
Multi-select chips, default = none selected. Open item: interest tag vocabulary isn't finalized by Admin yet.

### Optional Block B — Content mix
```
( ) Surprise us — a good age-appropriate mix        [default]
( ) Let me choose categories  →  Animation · Stories · Storybooks · Crafts ·
    Painting · Science · Maths · Yoga · Activities · Educational ·
    Music/Rhymes · Knowledge/General Learning
```

### Optional Block C — Development goal (never shown to parent)
| Age band | Default Development Goals |
|---|---|
| 0–2 | Motor Skills, Communication, Emotional |
| 2–3 | Communication, Emotional, Social |
| 3–4 | Social, Emotional, Creativity |
| 4–5 | Cognitive, Creativity, Problem Solving |
| 5–6 | Cognitive, Problem Solving, Learning |

Flag: a product-sequencing default, not a clinical claim — deserves the same expert-review pass content already gets.

### Optional Block D — Regulation goal
| Parent sees | Engine tag |
|---|---|
| Help them calm down | Calm |
| Manage big feelings | Emotional Regulation |
| Build focus | Focus |
| Burn off energy | Movement |
| Wind down before bed | Relaxation |
| Play nicely with others | Social Regulation |

### Optional Block E — Screen time & breaks (first-time defaults)
Duration picker **15 / 30 / 45 / 60 / 90 min**, break count derived at one break per 15 minutes:

| Session length | Total breaks | Mid-session breaks | Final break |
|---|---|---|---|
| 15 min | 1 | 0 | Wind-down only |
| 30 min | 2 | 1 | + Wind-down |
| 45 min | 3 | 2 | + Wind-down |
| 60 min | 4 | 3 | + Wind-down |
| 90 min | 6 | 5 | + Wind-down |

The last break is always the mandatory wind-down. Break type: Movement / Quiet-calm / Let KidQ alternate (default).

### Language — Phase 1 decision
English only for phase 1. Multi-language (Hindi + regional languages per `kidQ Design.md` §3.4) is explicitly out of scope for this version, not dropped — revisit in phase 2.

### Open item carried over — none
Language is now decided (above), not open.

---

## 2. Session Assembly Rules

Fills the gap between "filter and rank videos" (already specified) and "assemble a session that adds up to the chosen duration" (wasn't).

1. **Break count sets the number of slots** — same table as Block E above; each slot ≈ 15 minutes of viewing, ending in a break.
2. **Each slot fills greedily** from the ranked list (existing relevance + KidQ score + expert review + parent preference order) until the next video would overflow the slot.
3. **Never cut a video short to hit the clock** (already established in `kidQ Design.md` §5.3) — a break triggers at the nearest video boundary at or after the target minute.
4. **Category rotation** in "Surprise us" mode — rotate across the 2–3 categories implied by that age's default Development Goals; no same category twice in a row.
5. **The final slot leans calm on purpose** if "Wind down before bed" or "Help them calm down" is an active Regulation Goal.
6. **Thin eligible pool — bounded fallback, never silent on safety.** If a slot's pool of age-band + safety-tagged content is too thin to fill, the engine may pull from the immediately adjacent age band only (e.g. a 3–4 slot may draw from 2–3 or 4–5) — always still from KidQ's own admin-approved, safety-reviewed catalog, never wider and never uncurated content. Disclosed to the parent afterward, factually, in the session log or session-complete notification (e.g. *"A couple of videos today came from a neighboring age range — content was a little thin in [age band] this week"*) — not asked upfront, to avoid adding friction to something meant to stay rare. Depends on the content-pool-depth monitor in Section 9.
7. **"Let me choose categories" mode** uses the identical slot / greedy-fill / rotation mechanics as "Surprise us," restricted to only the categories the parent chose.

---

## 3. Session duration & tolerance rule (proposal)

- **Presets (15/30/45/60/90 min) get a tight, invisible tolerance — not shown to the parent.** A small buffer (a few minutes) lets the last video in a slot finish naturally (Rule 3 above). Backend plumbing, not a parent decision.
- **A fully custom duration** snaps to the nearest 30-minute building block, each carrying its own 2 breakpoints. The very last break of the whole session is still the only mandatory wind-down.

Proposal, not confirmed — flagged for sign-off.

---

## 4. Recurring session handoff flow

0. **If more than one child profile exists, P7a opens on a child-switcher first** — each child shown by nickname and their mascot color (Section 1). Selecting a child reveals that child's own duration picker; each child's last-used duration is remembered independently and never shared across children.
1. Parent opens the app. They do **not** repeat onboarding — they land on **P7a Start a Session**: a lightweight duration picker only (reuses the Block E picker), not the full P7 Settings screen.
2. Parent taps or voices a duration (Section 8) and hands the device to the child.
3. **Business-logic addition to the existing Child Player screen:** the session starts live the moment the parent confirms the duration — no separate "kid taps start" step. The child never sees a duration control themselves, consistent with "no settings icons in child view" (`kidQ Design.md` §3.1).
4. **Changing the duration is available any time the parent wants** — there's no restriction to "once a day." If they don't touch it, it defaults to whatever they last set.
5. A parent can start another session later the same day (e.g., a 30-min evening session) — P7a is reusable any number of times per day, each independently running the Session Assembly Rules (Section 2).

### Phase 1 vs. phase 2 — confirmed split
**Phase 1 (this spec):** one duration setting, changeable any time, otherwise defaults to the parent's last choice. One curation profile per child.

**Phase 2 (explicitly deferred, not designed here):** multiple context-based duration/curation profiles — e.g. a "bedtime" mix, a "daytime" mix, a "holiday" mix — the parent picks which mode applies rather than reconfiguring each time. Logged as a real, named phase-2 feature so it isn't lost, not built now.

---

## 5. Session-complete notification

Extends the existing P8 Handoff & Insight Tray (factual watched-content log + 👍/👎).

- When a session ends (wind-down or early exit), the parent gets an automatic notification: duration, what was watched (titles + durations), and how it ended (completed / skipped / exited — this outcome value already exists per `KidQ_Screens_and_Logic.docx` C7).
- Notification copy stays neutral and factual, per the existing behavioral-precaution rules (`kidQ Design.md` §7).

**Deferred, per your own note:** kid-to-parent reaction/chat ("share with Mumma," "chat with Dada") is out of scope for now.

---

## 6. Analytics / Insight Dashboard

`kidQ Design.md` §5.5 already lists "time by category," "time by day and week," and "a simple trend over time" as things a parent dashboard should show; this makes it concrete and extends it to month.

For a multi-child household, P8b opens with the same child-switcher used on P7a (Section 4) — analytics are always viewed one child at a time.

### What it shows
- Time spent per content category, sliceable by **day / week / month**.
- Total screen time per session, per day, per week, per month.
- Completion vs. early-exit rate, aggregated over time.

### Proposed additional metrics (your call on which to build first)
- **Wind-down completion rate** — measures whether the core mechanism (a session that "ends on purpose") is working.
- **Regulation-goal coverage** — how much watch time went to content tagged for the goals the parent actually selected.
- **Content-source breakdown** — KidQ-recommended vs. Parent-added vs. Admin-approved-from-parent-submission.
- **Most-repeated titles** — factual watch count, useful for deciding what to add permanently.

All stay factual, not behavioral — none infer attention, mood, or preference.

---

## 7. My Videos — parent URL submission flow

### P9a — Add a Video
- Parent pastes a YouTube URL. **Default state: Private** — usable by this family immediately, no admin approval needed.
- Toggle: **"Also suggest this to other families"** — sends it into the Admin review queue (`KidQ_Screens_and_Logic.docx` A2). Never changes this family's own instant access either way.

### Editing / removing a video
Each My Videos entry supports **Remove** (long-press, or a "···" menu) — takes it out of this family's library. No separate "edit URL" flow for phase 1; a wrong link is removed and re-added.

### Library tagging
- **Picked by [Parent name]** — privately added, not yet admin-reviewed.
- **KidQ recommended** — from the admin-approved catalog, matched by the engine.
- **Admin-approved, suggested by [Parent name]** — a parent's Public submission, now approved and eligible for other families too.

### P9b — Submission approved notification
When Admin approves a parent's Public submission: *"Thank you for the recommendation — [Title] is now approved and may be suggested to other families too."*

### P9b (companion) — Submission not approved notification
When Admin does not approve a parent's Public submission, the parent gets a neutral, factual notification (no reason shown) — the video's **Private** status is completely unaffected either way; this family keeps using it exactly as before.

### Removing a KidQ-recommended video (per child)
Separate from My Videos (which is about videos the parent adds): a parent can also remove any KidQ-recommended video from a specific child's future recommendations, via **"Remove from [Child]'s videos"** — available from the Handoff log (P8) or My Videos (P9). This is **per-child, not per-family** — removing a video for one child doesn't affect a sibling's own recommendations. Stored as a per-child exclude list the Session Assembly step checks before filling any slot (Section 2). Confirmed for phase 1 — reuses the same family-preference infrastructure as 👍/👎 feedback and My Videos tagging, so the added backend cost is low.

---

## 8. Voice input

### Where voice fits (ranked)
1. **Content curation — best fit.** Rides the *existing* P3 "Talk or type to KidQ" door and P4's AI-suggestion review screen. Not new scope — voice is one more input modality into an already-planned conversational flow.
2. **Session time (P7a) — best fit for the everyday action.** Single low-ambiguity value ("thirty minutes"), used every time a parent starts a session.
3. **Mandatory profile fields (nickname, age, consent) — voice stays OFF here.** Tap is faster and more reliable for short structured fields, and P1's consent gate specifically requires "an explicit consent action, not a pre-checked box" — voice adds misrecognition risk to the one step that's compliance-critical.

### Curation-by-voice flow
1. Parent speaks freely (e.g., "calming animal stories before bed").
2. An AI/NLU step extracts whatever it can into the three existing tag dimensions: **Content Category, Interests, Regulation Goal**.
3. Whatever wasn't covered by the voice input **falls back to existing defaults** (Surprise-us content mix, all regulation goals included) — never a new "please clarify" re-ask flow.
4. Parent sees a review screen: what was extracted from their voice + what got filled in as default (this is the existing P4 accept/reject screen, unchanged in shape).
5. Parent either accepts, or redoes the voice input — the retry is a second attempt at step 1–2, not a new screen.

### Frequency — curation vs. session time
- **Session time**: asked every time (Section 4) — lightweight, no review screen needed, just confirm the number.
- **Curation**: set once (onboarding, or whenever a parent deliberately chooses to change it) — **not** re-run every session. Repeating the full voice-review loop daily would break the "under 60 seconds," "everything after consent is skippable" principle already established everywhere else in this project. The daily flow is: say/tap a duration → session starts, using whatever curation is already saved.
- **Open item:** should "change curation" be a parent-initiated action only, or should the system ever prompt for it (e.g., weekly, or when the approved library runs low)? Recommend parent-initiated only for phase 1 — flagged for sign-off, not decided here.

---

## 9. Backend & API surface

Everything above implies backend components. Listed here so nothing gets built twice or missed.

| Component | What it does | Status |
|---|---|---|
| **Content scoring / recommendation engine** | Ranks admin-approved content by relevance + KidQ Score + expert review + parent preference (`KidQ_Architecture_Process.md` §11–12). Your teammate's current build — pulling ~140 videos, scoring pacing/language/content/visual/audio via an LLM — is this component. | in progress (owned by your teammate) |
| **Session Assembly / Timing API** | Takes a chosen duration + a child's filters, returns the actual slot-by-slot video queue per Section 2's rules (greedy fill, never cut mid-video, category rotation, calm final slot). | **new — needs building**, separate from the scoring engine above even though it consumes its output |
| **Voice-to-tag NLU API** | Takes a voice transcript, returns a best-effort mapping to Content Category / Interests / Regulation Goal (curation) or a single duration value (session time). Feeds the Section 8 review screen — never writes directly to a child's library. | **new — needs building** |
| **Analytics aggregation API** | Rolls up the factual watched-content log into the day/week/month category breakdowns and the proposed metrics in Section 6. | **new — needs building** |
| **Authentication** | Google Sign-In (OAuth) via Firebase Auth. One shared Google account per family — every caregiver signs in with it (Section 0). No custom domain required; free under Firebase's no-cost tier and Google's unverified-app allowance (fine under 100 users for phase 1). Email/OTP explicitly deferred, not built now. | **new — needs building** |
| **Content pool depth monitor** | Tracks how many admin-approved, safety-tagged videos exist per age-band × category combination; flags to the content/admin team before a combination gets thin enough to trigger the Section 2 fallback rule. Exists so that fallback stays rare in practice. | **new — needs building** |
| **Sync / persistence layer** | See "what syncs" below. | mostly implied by existing screens, worth stating explicitly |

### What has to sync to the backend (so nothing is missed)
- DPDP consent record (timestamp + version — already required by P1).
- Child profile: nickname, age band.
- Curation settings: content mix mode, categories chosen, interests, regulation goals — every time a parent changes them via UI *or* voice.
- Session duration + break/type preference, per session (not just a stored default — each actual session's chosen duration).
- My Videos: URL submissions, private/public status, and the admin approval state flowing back down (Section 7).
- Watched-content log + session outcome (completed/skipped/exited) — flows *up* from the child device after each session, feeding both the Insight Tray (P8) and Analytics (P8b).
- 👍/👎 feedback — feeds future ranking as a preference signal.
- The approved-library whitelist itself, at the moment of handoff (already an existing rule — restated here since it's part of the same sync surface).
- Device/offline-sync status (already named as a reporting need in `kidQ Design.md` §5.5) — whether a rule or an updated queue has actually reached the child's device yet.
- Each child's mascot color choice (Section 1).
- Per-child video exclude list (Section 7) — checked by the Session Assembly API before filling a slot.
- Per-child last-used session duration (Section 4) — for a multi-child household, stored independently per child, never shared.

---

## 10. Open items requiring sign-off

1. Interests tag vocabulary (Section 1, Block A) — not finalized.
2. Development Goal age-band weighting (Section 1, Block C) — product default, wants expert-review pass.
3. Session tolerance buffer size and custom-duration snapping (Section 3) — proposed, not confirmed.
4. Which proposed analytics metrics (Section 6) to build first.
5. Exact wording/trigger conditions for the P9b approval notification (Section 7).
6. Whether "change curation" is ever system-prompted or always parent-initiated (Section 8).
7. Ownership split between the recommendation/scoring engine (in progress) and the new Session Assembly API (Section 9) — confirm these are being built as two separate components, not folded into one.

---

## 11. Parent Flow — Gap Review & Resolutions (2026-09-12)

A completeness pass over Sections 1–9 against the full Parent Flow scope, grilled and closed out the same day. Every item below is now a **resolved decision**, folded into the section named — this list is kept only as a record of what was decided and why, not as an open question list.

1. **Multi-child selector at "Start a Session" (P7a) — resolved.** P7a opens on a child-switcher first when more than one child exists; each child's last-used duration is remembered independently. See Section 4, point 0.
2. **"Submission rejected" state — resolved.** Added a companion notification to P9b for a non-approved submission — neutral tone, no reason shown, private access unaffected. See Section 7.
3. **Edit/delete in My Videos (P9) — resolved.** Added a **Remove** action per entry (long-press / "···" menu). No edit-URL flow for phase 1 — re-add instead. See Section 7.
4. **Session interruption/resume — resolved.** No resume in phase 1. An early exit always ends that session; the next P7a always starts fresh. Kept deliberately simple rather than building partial-session state.
5. **Account creation/login — resolved.** Google Sign-In only (OAuth via Firebase Auth), no domain required. See Section 0 ("Login & entry routing") and Section 9.
6. **Multiple caregivers per child — resolved for phase 1.** One shared Google account per family; every caregiver signs in with the same account. Separate per-caregiver identities under one household are deferred to phase 2. See Section 0.
7. **Settings (P7) detail — resolved.** Explicit fields: Autoplay (on/off, default on), Break type default (Movement / Quiet-calm / Let KidQ alternate, default Alternate), Sensory-friendly mode (on/off, default off), Daily schedule (on/off + time range, default off).
8. **Thin eligible pool + "choose categories" mode — resolved.** Bounded silent fallback (adjacent age band only, same admin-approved catalog, disclosed to the parent after the fact, never asked upfront) plus a new backend content-pool-depth monitor so the fallback stays rare. "Choose categories" mode confirmed to use identical slot mechanics, restricted to the chosen categories. See Section 2, points 6–7, and Section 9.
9. **Analytics dashboard (P8b) multi-child gap — resolved.** Same child-switcher as P7a, reused. See Section 6.
10. **Age-band update trigger — resolved.** Updates silently and automatically in the background the moment a child's age crosses a band boundary — no parent prompt, consistent with Development Goal defaults already being invisible to the parent.

### Additional items raised during this same review pass

11. **Mascot / avatar color per child — resolved.** Parent picks one of KidQ's 5 existing brand accent colors per child (auto-assigned by default), used to tell children apart at a glance on the child-switcher. Not tied to gender by the system. See Section 1.
12. **Blocking a specific KidQ-recommended video — resolved, confirmed for phase 1.** Per-child (not per-family) exclude list, reusing existing 👍/👎 and My Videos infrastructure. See Section 7.
