# KidQ Parent Experience — Consolidated Spec

Merges and supersedes `KidQ_Parent_Onboarding_Field_Spec.md` and `KidQ_Session_Assembly_Rules.md`. Adds: session duration/tolerance, recurring session handoff, session-complete notification, analytics, My Videos, voice input, and the backend/API surface all of the above requires.

---

## 0. Screen inventory — what exists, what's new, what's still open

| # | Screen | Status | Notes |
|---|---|---|---|
| P1 | DPDP Consent Gate | existing | One-time, before any child profile. Unchanged. Tap-only — see Section 8. |
| P2 | Child Profile & Preferences | **revised** | Section 1 below. Screens 1–7 **mocked**. |
| P3 | (dissolved as a gatekeeping screen) | **revised** | No longer a mandatory detour. Its three "doors" are redistributed: talk/type and guided-questions become optional input shortcuts inside the Customize Hub (P2); browse-myself becomes a third top-level choice on Screen 2 (P2-confirm), alongside Start-using-KidQ and Customize. See Section 11 #16. |
| P3-guided | Guided Questions (new capture screen) | **new** | A short structured, tap-based Q&A alternative to voice, for parents who'd rather tap than talk or type. Converges on the same Hub fields voice input does. See Section 11 #16. |
| P4 | (dissolved) | **revised** | Its "review what we extracted" function is absorbed into the Hub itself — voice/guided capture fills the Hub's existing fields directly, with no separate review screen in between. See Section 11 #16. |
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
**Actions:** `[ Start using KidQ ]` (primary) → straight to P7a Start a Session, no detour · `[ Customize for {child} ]` (secondary) → opens the Hub (Blocks A, B, D, E) · `[ Browse and pick myself ]` (tertiary link) → straight to P5, bypassing preference-tagging and the recommendation engine entirely. See Section 11 #16 for the full reasoning behind this three-way split.

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
Duration picker **15 / 30 / 45 / 60 / 90 min**, plus a **break interval** picker — **10 / 15 / 20 min** (default 15). Interval is set here, at curation time — same tier as break type, not re-asked at every session (Section 4/8). Break count is derived from the two together: **total breaks = duration ÷ chosen interval, rounded to the nearest whole slot.**

| Session length | Interval | Total breaks | Mid-session breaks | Final break |
|---|---|---|---|---|
| 15 min | 15 min | 1 | 0 | Wind-down only |
| 30 min | 15 min | 2 | 1 | + Wind-down |
| 30 min | 10 min | 3 | 2 | + Wind-down |
| 45 min | 15 min | 3 | 2 | + Wind-down |
| 60 min | 15 min | 4 | 3 | + Wind-down |
| 90 min | 15 min | 6 | 5 | + Wind-down |

Table shows the default 15-min interval plus one 10-min example — the formula applies to any duration/interval combination a parent picks, not just these rows.

The last break is always the mandatory wind-down, regardless of interval. Break type — Movement / Quiet-calm / Let KidQ alternate (default) — is a separate, independent choice from interval, on the same screen.

### Language — Phase 1 decision
English only for phase 1. Multi-language (Hindi + regional languages per `kidQ Design.md` §3.4) is explicitly out of scope for this version, not dropped — revisit in phase 2.

### Open item carried over — none
Language is now decided (above), not open.

---

## 2. Session Assembly Rules

Fills the gap between "filter and rank videos" (already specified) and "assemble a session that adds up to the chosen duration" (wasn't).

1. **Break count sets the number of slots** — derived from the child's saved duration and break-interval settings (Block E): total breaks = duration ÷ interval, rounded; each slot ≈ the chosen interval's length of viewing, ending in a break. Interval is a curation-time setting (set once in the Hub, editable any time — not re-asked at Start a Session), same tier as break type.
2. **Each slot fills greedily** from the ranked list (existing relevance + KidQ score + expert review + parent preference order) until the next video would overflow the slot.
3. **Never cut a video short to hit the clock** (already established in `kidQ Design.md` §5.3) — a break triggers at the nearest video boundary at or after the target minute.
4. **Category rotation** in "Surprise us" mode — rotate across the 2–3 categories implied by that age's default Development Goals; no same category twice in a row.
5. **The final slot leans calm on purpose** if "Wind down before bed" or "Help them calm down" is an active Regulation Goal.
6. **Thin eligible pool — bounded fallback, never silent on safety.** If a slot's pool of age-band + safety-tagged content is too thin to fill, the engine may pull from the immediately adjacent age band only (e.g. a 3–4 slot may draw from 2–3 or 4–5) — always still from KidQ's own admin-approved, safety-reviewed catalog, never wider and never uncurated content. Disclosed to the parent afterward, factually, in the session log or session-complete notification (e.g. *"A couple of videos today came from a neighboring age range — content was a little thin in [age band] this week"*) — not asked upfront, to avoid adding friction to something meant to stay rare. Depends on the content-pool-depth monitor in Section 9.
7. **"Let me choose categories" mode** uses the identical slot / greedy-fill / rotation mechanics as "Surprise us," restricted to only the categories the parent chose.
8. **Time-of-day context layer — two-layer split (2026-09-14).** A session's time band (Morning / Daytime / Evening / Bedtime) is exposed as `[Auto][Morning][Daytime][Bedtime]` mode chips on P7a, default Auto, remembered until changed. Split deliberately into two independent layers so one can ship without the other:
   - **Layer 1 — ships now, no dependency on the recommendation engine.** In Auto mode, the band is decided **server-side from the server's own clock** — never the device clock — so a parent manually changing their phone's system time cannot silently change the band; the client sends only the selected mode, not a timestamp. The band drives copy/asset selection only: the Orange Agent's opening greeting (~30–60s, sits outside the chosen duration) and the closing wind-down message flavor. Priority when signals disagree: manual mode selection → saved Regulation Goal → automatic clock. None of this touches which videos get picked, so it can't look "half-built" to a parent.
   - **Layer 2 — pending backend confirmation, not yet built.** The same band would also bias which videos Session Assembly selects (brighter vs. calmer). This does **not** exist in the Recommendation Engine spec today (`KidQ_Architecture_Process.md` §11 has no time-of-day input) — do not assume it's available, and don't build UI that implies it's happening until backend confirms. If Layer 2 never ships, nothing looks incomplete: the queue just fills normally, with no visible "should have been time-customized" gap.
9. **No ad or monetization slot between videos.** Considered and dropped (2026-09-14) — breaks remain activity-only (Orange Agent), same as always. The final break of every session stays the mandatory wind-down activity, unchanged.

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

### P9a — Add a Video (updated: auto-detect → score badge → review → add)
- Parent pastes a YouTube URL. KidQ auto-fetches title, thumbnail, duration, channel, and content category — no manual entry.
- KidQ runs its content-scoring check on the detected video and shows the result as a simple trust badge (e.g. "✓ Reviewed") — never a raw numeric score. Tapping the badge can optionally expand into a plain-language readout of the scoring dimensions (pacing, language, content, visual, audio) — opt-in, not required.
- Parent reviews the detected details and badge, then taps **Add Content** to confirm — replaces the previous blind paste-and-add with a review-before-add step, still one linear flow.
- **The score is informational only for a parent's own private use — never a gate.** Whatever the result, the parent decides. Even a low score doesn't block **Add Content**; KidQ shows what it found, the parent stays in control of their own family's library. (This is unchanged from — and now made explicit alongside — the Public-submission path below, which is the only place a human admin review actually gates anything.)
- **Default state: Private** — usable by this family immediately, no admin approval needed. The scoring check above is automated and near-instant regardless of Private/Public status — it is not a human review gate, so it never delays private use.
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
| **Content scoring / recommendation engine** | Ranks admin-approved content by relevance + KidQ Score + expert review + parent preference (`KidQ_Architecture_Process.md` §11–12). Your teammate's current build — pulling ~140 videos, scoring pacing/language/content/visual/audio via an LLM — is this component. Also invoked at the moment a parent adds content (P9a) to generate the trust badge shown before Add Content is confirmed (Section 7) — must run fast enough to feel instant, not a blocking review. | in progress (owned by your teammate) |
| **Session Assembly / Timing API** | Takes a chosen duration + a child's filters, returns the actual slot-by-slot video queue per Section 2's rules (greedy fill, never cut mid-video, category rotation, calm final slot). | **new — needs building**, separate from the scoring engine above even though it consumes its output |
| **Voice-to-tag NLU API** | Takes a voice transcript, returns a best-effort mapping to Content Category / Interests / Regulation Goal (curation) or a single duration value (session time). Feeds the Section 8 review screen — never writes directly to a child's library. | **new — needs building** |
| **Analytics aggregation API** | Rolls up the factual watched-content log into the day/week/month category breakdowns and the proposed metrics in Section 6. | **new — needs building** |
| **Authentication** | Google Sign-In (OAuth) via Firebase Auth. One shared Google account per family — every caregiver signs in with it (Section 0). No custom domain required; free under Firebase's no-cost tier and Google's unverified-app allowance (fine under 100 users for phase 1). Email/OTP explicitly deferred, not built now. | **new — needs building** |
| **Content pool depth monitor** | Tracks how many admin-approved, safety-tagged videos exist per age-band × category combination; flags to the content/admin team before a combination gets thin enough to trigger the Section 2 fallback rule. Exists so that fallback stays rare in practice. | **new — needs building** |
| **Client platform** | Responsive web app / PWA for MVP — works in any browser, phone or laptop, including laptop-to-TV via Chromecast/screen mirroring for the child's viewing device. No dedicated native Smart TV app for MVP; true remote-control/D-pad TV navigation is explicitly deferred, not built now. | **decided** |
| **Sync / persistence layer** | See "what syncs" below. | mostly implied by existing screens, worth stating explicitly |
| **Time-band determination service** | Decides the active time band (Morning/Daytime/Evening/Bedtime) using the **server's own clock** when the parent's mode is Auto — client sends only the selected mode, never a device timestamp. Feeds Layer 1 only (Section 2, point 8): opener + wind-down copy. Independent of the recommendation engine. | **new — needs building** |
| **Time-of-day content ranking (Layer 2)** | Would bias Session Assembly's video selection by band. Not present in the Recommendation Engine spec today. Do not build or assume available until backend confirms feasibility. | flagged, not decided (Section 2, point 8) |

### What has to sync to the backend (so nothing is missed)
- DPDP consent record (timestamp + version — already required by P1).
- Child profile: nickname, age band.
- Curation settings: content mix mode, categories chosen, interests, regulation goals — every time a parent changes them via UI *or* voice.
- Session duration, per session (not just a stored default — each actual session's chosen duration). Break type and break interval, per child, as curation-time settings — changed only when a parent deliberately updates them via the Hub, not per session.
- My Videos: URL submissions, private/public status, and the admin approval state flowing back down (Section 7).
- Watched-content log + session outcome (completed/skipped/exited) — flows *up* from the child device after each session, feeding both the Insight Tray (P8) and Analytics (P8b).
- 👍/👎 feedback — feeds future ranking as a preference signal.
- The approved-library whitelist itself, at the moment of handoff (already an existing rule — restated here since it's part of the same sync surface).
- Device/offline-sync status (already named as a reporting need in `kidQ Design.md` §5.5) — whether a rule or an updated queue has actually reached the child's device yet.
- Each child's mascot color choice (Section 1).
- Per-child video exclude list (Section 7) — checked by the Session Assembly API before filling a slot.
- Per-child last-used session duration (Section 4) — for a multi-child household, stored independently per child, never shared.
- Session's selected time-of-day mode (Auto/Morning/Daytime/Bedtime), per session — same tier as session duration, not a curation-time setting (Section 2, point 8).

---

## 10. Open items requiring sign-off

1. Interests tag vocabulary (Section 1, Block A) — not finalized.
2. Development Goal age-band weighting (Section 1, Block C) — product default, wants expert-review pass.
3. Session tolerance buffer size and custom-duration snapping (Section 3) — proposed, not confirmed.
4. Which proposed analytics metrics (Section 6) to build first.
5. Exact wording/trigger conditions for the P9b approval notification (Section 7).
6. Whether "change curation" is ever system-prompted or always parent-initiated (Section 8).
7. Ownership split between the recommendation/scoring engine (in progress) and the new Session Assembly API (Section 9) — confirm these are being built as two separate components, not folded into one.
8. **PDF/classwork upload (teammate proposal, 2026-09-13)** — is this scoped as link-extraction only (KidQ finds video links mentioned inside a PDF), or is the PDF itself meant to become child-facing content? For a 0–6 audience the latter doesn't fit the product — recommend link-extraction only, but needs explicit team confirmation before scoping.
9. ~~Per-video breakpoints/activities (teammate proposal, 2026-09-13)~~ — **resolved, see Section 11 #21–22.** Breaks stay a per-child curation setting (interval + type), not authored per video; the Orange KidQ Agent is confirmed in scope as the existing break-time host character, separate from the per-child mascot color.
10. **7-category content taxonomy (from teammate's v5 update, 2026-09-14)** — analyzed (config-driven labels + a one-time catalog re-tagging migration needed), but **not yet merged** into Section 1 Block B. This is a separate decision from the time-of-day layer above — needs your explicit go-ahead before Block B's category list is replaced.
11. **Audio-only content (standalone music at session end)** — raised 2026-09-14, no content type for this exists in any doc today (the only related thing on record is P7's ambient "background music" sensory setting, which is different). Not building until backend/content team confirms this content type is real. See Section 11 #36.

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
13. **Client platform — resolved.** Responsive web app / PWA for MVP (phone or laptop browser; laptop-to-TV via Chromecast/mirroring covers the "watched on the TV" case) rather than a dedicated native Smart TV app. True TV remote/D-pad navigation explicitly deferred. See Section 9.
14. **Development Goal visibility — reconfirmed, unchanged.** Stays hidden from the parent (Section 1, Block C) — raised again during this pass, decision unchanged.
15. **Voice input screens were missing from the prototype (not the spec) — now added.** Section 8 always specified voice at content curation (P3/P4) and session time (P7a); the prototype build had skipped the actual capture UI. Added: a "Talk or type to KidQ" capture screen (mic + text box) between P3 and P4, and a mic option alongside the duration pills on P7a.
16. **P3/P4 screen-flow logic grilled and restructured — resolved.** Two real bugs surfaced in the same review pass:
    - **Bug A — the default and Hub-finish paths both forced a detour through P3.** Both "Start using KidQ" (P2-confirm) and "Done — start using KidQ" (the Hub's finish button) routed to P3's three-door screen before reaching a session, even for a parent who explicitly chose not to customize anything. Traced back to the original spec text itself ("Start using KidQ → skips to P3"), not introduced independently during prototyping.
    - **Bug B — P3's second door had no real destination of its own.** "Answer a few guided questions" pointed at the exact same screen as "Talk or type to KidQ"'s result, with no distinct guided-question interaction ever designed for it — a dead duplicate, not a working alternate path.
    - **Resolution — P3 is dissolved as a standalone gate, its three doors redistributed to where they logically belong:**
      1. P2-confirm now offers three coequal top-level choices: **Start using KidQ** (defaults, straight to P7a), **Customize** (opens the Hub), and **Browse and pick myself** (straight to P5 — this is fundamentally different in kind from the other two, since it skips preference-tagging and the recommendation engine altogether, so it does not belong nested inside the Hub or a conversational flow).
      2. Inside the Hub, tapping fields directly stays the default interaction. Two small optional shortcuts sit alongside it for parents who'd rather not tap through everything themselves: **"Talk or type to KidQ"** (voice/text capture, now a real, newly-designed guided Q&A screen) and **"Answer a few guided questions"** (a short structured wizard: "What does [child] enjoy more — stories or active play?" and "What matters most right now — calming down, focus, or energy?"). Both are alternate *input methods* for the same Hub fields, not separate destinations — each fills in the Hub's Interests/Content-mix/Regulation rows directly and returns the parent to the Hub to review or adjust by tapping, with no separate "review what we extracted" screen in between (this is what dissolves P4 — its function is now just the Hub, prefilled).
      3. The Hub's finish button ("Done — start using KidQ") goes straight to P7a, same as the plain-default path — no remaining detour either way.
17. **Back navigation and an escape hatch — resolved.** A real gap: no screen had a way back, so a parent who started customizing and changed their mind had no way to return to KidQ's own recommendation without abandoning the app entirely. Fixed with two mechanisms: (a) a standard back arrow on every screen that has a logical prior step (P1 back to login, P2 screens back to the previous P2 step, P5 back to P2-confirm, and so on); (b) inside the Hub and its voice/guided capture screens specifically, an explicit one-tap **"Never mind — use KidQ's recommendation instead"** link, which resets any in-progress customization back to defaults and goes straight to P7a — for the specific case this review surfaced, where stepping back screen-by-screen through several levels of customization would be tedious.
18. **The Hub was unreachable outside first-time onboarding — resolved.** Previously, once a parent finished onboarding there was no way to ever change curation preferences again short of a fresh signup — Settings (P7) only covered autoplay/break-type/sensory-mode/schedule, none of which touch Interests, Content mix, or Regulation goals. Fixed by adding a "Content & curation preferences" entry point to both **Settings (P7)** and **Start a Session (P7a)**, both opening the same Hub. The Hub's finish button adapts to context — "Done — start using KidQ" when reached during first-time onboarding, plain "Save & back" when reached from Settings or Start a Session, since the parent is already using the app in that case.
19. **Where parents see KidQ's recommendations and the KidQ Score — resolved (2026-09-13).** Recommendations surface where they already did: the P5 "Made for [child]" shelf, and the source tag on My Videos (P9). The Score itself is never shown as a raw number — it appears as a simple trust badge on video cards (P5, P9, and the P8 session log), with an optional tap-to-expand into plain-language scoring dimensions (pacing, language, content, visual, audio) for a curious parent. Analytics (P8b) gets one added aggregate line reinforcing this (e.g. "X% of what they watched was KidQ-reviewed") — no new mandatory screen or tap anywhere in the flow.
20. **Add-a-Video flow upgraded — resolved (2026-09-13), from a teammate proposal.** P9a now auto-fetches YouTube metadata (title, thumbnail, duration, channel, category) and shows the KidQ-check trust badge before the parent confirms Add, replacing the previous blind paste-and-add. See Section 7. Two related ideas from the same proposal — parent PDF/classwork upload, and per-video breakpoints/activities with a "KidQ AI Mascot" — are logged as open items rather than resolved here; see Section 10, items 8–9.
21. **Break interval made parent-configurable, at the child/curation level — resolved (2026-09-13).** A parent can now choose how often breaks occur (10/15/20 min, default 15) alongside break type, set once during curation (Block E) and editable any time via the Hub — never re-asked at Start a Session, and never set per individual video. The break-count table becomes a formula (duration ÷ interval) rather than a fixed lookup. Breaks still snap to the nearest video's end, never mid-play — same tolerance principle as overall session length (Section 3), just applied per break. This also settles the "per-video breakpoints" question from item #9 in Section 10 in the simpler direction: breaks stay a per-child setting, not something authored per video.
22. **Orange KidQ Agent confirmed for phase 1 — resolved (2026-09-13).** Already specified in `KidQ_Architecture_Process.md` / `KidQ_Screens_and_Logic.docx` as the break-time host character (pauses video, gives a short instruction, runs a 20–30s activity, resumes) — team confirmed it stays in scope, no new design needed. It appears on the child's screen during a break, not on a parent-facing screen; if a parent-facing preview is wanted, Kid View Preview (P6) is the natural fit, since that screen already mirrors exactly what the child sees.
23. **Scoring on a parent-uploaded video is informational only, never a gate on private use — resolved (2026-09-13).** KidQ still runs and shows the score/trust badge on every parent-added video, so the recommendation signal is always visible — but the parent has final say. A low score does not block **Add Content**; the parent can add it anyway for their own family's use. Only the separate Public-submission path (Section 7) still routes through human Admin review, and only for making that video recommendation-eligible to *other* families — never for this family's own access.
24. **P5 accept model — resolved (2026-09-14).** Hybrid: the recommendation shelf defaults to every video selected; the parent can deselect any before confirming, or just tap through with everything left selected. One primary action ("Looks good — Add to Library") commits whatever is currently selected as a single batch write — not a mandatory per-video Add/Remove tap, and not an all-or-nothing accept either.
25. **Voice input uses on-device speech-to-text — resolved (2026-09-14).** Speech-to-text runs in the browser, client-side, not as a server call. Only the resulting text is ever sent to the backend. The "Voice-to-tag NLU API" (Section 9) therefore only ever receives already-transcribed text — no raw audio handling, upload, or separate STT service to build or pay for.
26. **Hub saves in one batch on exit — resolved (2026-09-14).** Changes made while a parent is inside the Hub (Interests / Content mix / Regulation / Screen time, including via voice or guided capture) stay local until the parent taps Done or Save & back — one write fires then, not one write per tap. A parent backing out mid-change simply discards the local edits; nothing partial is ever saved.
27. **Daily schedule (P7 Settings) behavior — still open, no decision made.** Does the on/off + time-range toggle just display the parent's intended routine (no enforcement), or does it actually restrict/warn when a session starts outside that window? Recommend reminder-only for phase 1 (far smaller backend scope — just stores the range, no gating logic) — but this needs an explicit call before Settings is built, not assumed.

### Gaps found while consolidating UI vs. backend logic (2026-09-14) — flagged, not decided here

28. **YouTube metadata fetch isn't listed as its own backend component.** P9a's auto-fetch (title, thumbnail, duration, channel, category) requires calling out to YouTube itself — this dependency wasn't named anywhere in Section 9. Added to Section 12.
29. **No notification-delivery mechanism is specified anywhere.** Three screens (P8a session-complete, P9b approved, P9b-reject) depend on the parent actually being notified, but nothing says how — push, in-app polling, or email. Needs a decision before any of the three can be built. Added to Section 12.
30. **Voice-duration parsing (P7a's "thirty minutes") is simpler than curation-voice parsing, and the spec currently treats them as the same thing.** A single low-ambiguity number-plus-unit value doesn't need a full NLU/LLM call — a small client-side parser is enough, and is faster and cheaper than routing it through the same backend API curation voice uses. Recommend splitting these explicitly. Added to Section 12.
31. **Session Assembly needs to output a "used fallback" flag, and nothing currently specifies that field.** P8a's after-the-fact disclosure line (Section 2 Rule 6) depends on knowing whether this session pulled from an adjacent age band, and which category — this isn't in Section 9's sync list today. Added to Section 12.
32. **Analytics' "% KidQ-reviewed" stat needs a join with the scoring engine that isn't stated as a dependency anywhere.** To compute it, the Analytics aggregation API has to read the Content scoring engine's badge/pass-fail result per watched video — a cross-component dependency Section 9 doesn't currently name. Added to Section 12.
33. **Age-band default presets (Development Goals, default content mix) are likely better served from backend config than hardcoded client-side**, so they can be tuned after the expert-review pass (Section 10 item 2) without an app release. Not decided, flagged for confirmation.

### Additional items raised 2026-09-14

34. **Time-of-day context layer — resolved.** Two-layer split: mode chips + Orange Agent greeting + wind-down copy ship now, server-clock-determined in Auto mode (never the device clock, so a manually changed phone clock can't silently change the band); actual content re-ranking by band stays a separate, unbuilt Layer 2 pending backend confirmation. See Section 2, point 8, and Section 9.
35. **No ad/monetization slot between videos — resolved.** Raised, then clarified as a naming mix-up, not a real proposal — there is no advertising feature in the Parent Flow. Breaks remain activity-only; the final break of every session stays the mandatory wind-down activity, unchanged from the existing design. See Section 2, point 9.
36. **Audio-only content (standalone music at session end) — flagged, not decided.** No content type for this exists in any doc today (`KidQ_Content_to_Child_Pipeline.docx` content record fields, and `KidQ_Architecture_Process.md` §9 Content Category list, are both video-only; the only adjacent concept is P7's ambient "background music" sensory setting, which plays under video, not as its own end-of-session item). Do not build any UI or copy implying this exists until backend/content team confirms. See Section 10, item 11.

---

## 12. UI vs. Backend — Consolidated Logic Breakdown (2026-09-14)

Every screen's logic, split into what the UI handles on its own versus what needs a backend API/engine — so a UI build can proceed against Table A without waiting on Table B, and nothing gets silently built twice or missed. Table B's **Backend component** column matches the names already used in Section 9.

### Table A — UI-side logic (client-only, no backend round-trip beyond a plain read/write)

| Screen | UI-side logic / validation |
|---|---|
| P0 Login | Google Sign-In button; hand-off to OAuth redirect; loading state until the backend returns the first-time-vs-returning routing flag. |
| P1 Consent | Checkbox is tap-only, never pre-checked; Continue stays disabled until checked. No field validation beyond the tap itself. |
| P2-mandatory | Required-field check (parent name, each child's nickname, age band) before Continue enables. Mascot color auto-cycles through the 5 brand colors as children are added — a client-computed default, no backend call needed just to pick it. Child-count stepper bounded 1–6. |
| P2-confirm | Renders the three top-level choices (Start / Customize / Browse myself) and the age-derived defaults — the *values* shown should come from backend config (see Table B, item 4), but rendering them is pure UI. |
| Hub (P2-hub) | Holds all in-progress edits locally; live-updates each row's summary text as the parent taps; nothing persists until Done / Save & back (Section 11 #26). |
| P2-interests / -contentmix / -regulation / -screentime | Chip/toggle selection state; live break-count preview as duration/interval change, computed client-side from the Section 2 Rule 1 formula — no round-trip needed just to preview it. |
| P3-voice | Mic tap state machine (idle → listening → done); on-device speech-to-text produces the transcript directly in the browser (Section 11 #25) — only text ever leaves the client. Text-box typing is the same end state. |
| P3-guided | Two tap-to-select questions; Continue enables once both are answered. The answer→tag mapping is a simple static client-side lookup — no backend call for this screen at all. |
| P5 Recommendation | Shelf defaults every card to selected; parent can deselect individual cards; one primary action commits whatever's currently selected (Section 11 #24) — selection state is pure UI, only the final commit is a backend write. |
| P6 Kid View Preview | Read-only render of exactly what the child will see — must pull the same data Table B's Child Player/preview source returns, never an independently-maintained mock. |
| P7 Settings | Toggle states (Autoplay, Sensory mode); time-range picker for Daily schedule (behavior still open, item 27); "Content & curation preferences" row just navigates to the Hub. |
| P7a Start a Session | Child-switcher tap (local state); duration pills; mode chips `[Auto/Morning/Daytime/Bedtime]` (selection is local state, remembered until changed — the actual band in Auto mode is resolved server-side, see Table B item 20); mic reuses the same on-device STT as P3-voice, but only needs simple number/unit parsing client-side (see Table B, item 7) rather than the full curation NLU step; "Change content preferences" link navigates to the Hub. |
| P8a Session-complete | Read-only render of the notification payload (duration, titles watched, outcome, optional thin-pool disclosure line) — no client logic beyond display. |
| P8 Handoff / Insight log | 👍/👎 tap per video (optimistic UI, backend write follows); "Remove from [Child]'s videos" tap. |
| P8b Analytics | Day/Week/Month pill selector (re-queries backend per range); child-switcher; bar-chart rendering is pure client-side rendering of whatever the Analytics API returns. |
| P9 My Videos | List rendering; per-child mini-avatar toggle (optimistic UI, backend write follows); Remove action. |
| P9a Add a Video | URL input; loading state while metadata + score are fetched; score-badge tap-to-expand (reveals already-fetched detail, no extra call); Public/Private toggle; Add Content commit. |
| P9b / P9b-reject | Read-only notification render. |

### Table B — Backend components (API/engine logic)

| # | Backend component | What it does | Screens that depend on it | Status |
|---|---|---|---|---|
| 1 | Authentication (Google Sign-In via Firebase) | OAuth handshake; checks whether this account has completed onboarding for at least one child, returns first-time-vs-returning routing flag. | P0 | new — needs building |
| 2 | Consent record store | Persists DPDP consent (timestamp + version) once per account. | P1 | new |
| 3 | Child profile store | Persists nickname, age band, mascot color per child; silently updates age band in the background on a birthday-boundary crossing (Section 11 #10). | P2-mandatory, ongoing | new |
| 4 | Age-band default config (Development Goals, default content mix) | Serves the age→default mapping (Block C) so values can be tuned without an app release. | P2-confirm | **found gap — recommend adding**, not yet in Section 9 |
| 5 | Curation Settings API | Batch-saves Interests, Content mix, Regulation goals, Duration default, Break type, Break interval — one write per Hub visit, on exit (Section 11 #26). | Hub and all its sub-screens | new |
| 6 | Voice-to-tag NLU API | Takes already-transcribed text (STT is client-side) and returns a best-effort Content Category / Interests / Regulation Goal mapping. | P3-voice, Hub's voice shortcut | new — smaller scope than originally described, since audio never reaches it |
| 7 | Session-duration parsing | A small parser for a single number-plus-unit value ("thirty minutes"). Recommend client-side, separate from the full NLU API above — not yet split out in Section 9. | P7a | **found gap — recommend splitting from item 6** |
| 8 | Content scoring / recommendation engine | Ranks approved content for P5; runs a fast near-instant check on a parent-added video for the P9a trust badge. | P5, P9a | in progress (teammate) |
| 9 | Session Assembly / Timing API | Builds the slot-by-slot video queue from a child's approved library + duration + break interval/type; must output whether it used the adjacent-age-band fallback, and which category, so P8a can disclose it. | P7a → feeds Child Player | new; **the fallback-flag output field is a found gap** |
| 10 | YouTube metadata fetch | Given a pasted URL, retrieves title, thumbnail, duration, channel, category. | P9a | **found gap — not previously listed as its own component** |
| 11 | Admin review / Public-submission queue hook | Receives a video flagged "also suggest to other families," hands it into the Admin flow's existing review pipeline. | P9a (Public toggle) | cross-flow dependency — owned by the Admin flow; confirm the hand-off contract |
| 12 | Notification delivery mechanism | Actually gets a notification to the parent — push, in-app poll, or email; nothing currently specifies which. | P8a, P9b, P9b-reject | **found gap — undefined today** |
| 13 | Analytics aggregation API | Rolls up watched-content logs into day/week/month breakdowns; needs to join with item 8's badge data to compute the "% KidQ-reviewed" stat. | P8b | new; **the join with item 8 is a found gap** |
| 14 | Content pool depth monitor | Watches per age-band × category catalog depth; flags before the Section 2 fallback rule would trigger. | (backend-only, no screen) | new |
| 15 | Per-child video-exclude store | Per-child list of KidQ-recommended videos to stop suggesting; checked by Session Assembly before filling a slot. | P8, P9 | new |
| 16 | 👍/👎 feedback store | Feeds future ranking as a preference signal. | P8 | new |
| 17 | Session/watched-log ingestion | Receives the factual watched-content log + outcome (completed/skipped/exited) from the child device after each session. | P8a, P8, P8b (all consume it) | new |
| 18 | Sync / device status layer | Tracks whether a rule or updated queue has actually reached the child's device. | (backend-only) | new |
| 19 | Orange KidQ Agent / Activity data source | Already-specified break-time host + activity library (`KidQ_Architecture_Process.md`) — Parent Flow only touches it if P6's preview shows it. | P6 (optional) | existing elsewhere; confirm hand-off if P6 uses it |
| 20 | Time-band determination service | Decides the active band (Morning/Daytime/Evening/Bedtime) from the **server's own clock** in Auto mode; client sends only the selected mode, never a timestamp. Drives Layer 1 only — opener + wind-down copy (Section 2, point 8). | P7a | new — needs building, independent of item 8 |
| 21 | Time-of-day content ranking (Layer 2) | Would bias Session Assembly's slot-fill by band. Not present in the Recommendation Engine spec today — not built, not assumed available. | P7a → Session Assembly (if ever built) | flagged, not decided |

Items marked **found gap** above are new — surfaced during this consolidation pass, not previously listed anywhere in this document. None are silently decided; each needs a quick confirmation the same way earlier open items did.
