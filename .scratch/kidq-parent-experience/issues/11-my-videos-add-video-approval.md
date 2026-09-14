# 11: My Videos + Add-a-Video + approval notifications (P9, P9a, P9b/P9b-reject)

**What to build:** The parent's own video library — pasting a YouTube URL to add a video
privately (instant, never gated), optionally submitting it for Admin review to make it
recommendation-eligible for other families, and the approve/reject notifications that
follow.

**Blocked by:** 01 (App shell, design tokens & config source-of-truth), 02 (Login &
routing). Live wiring of the Public-submission path additionally requires the Admin
review queue contract to be confirmed with the team that owns it — build and test the
parent-side UI against a stub/mocked queue until that contract is available.

**Status:** ready-for-agent

- [ ] YouTube metadata fetch: given a pasted URL, retrieves title, thumbnail, duration,
      channel, and category, building on the existing YouTube Data API v3 config in
      `config/content-sources.json` (fetch fields already listed there).
- [ ] KidQ runs its content-scoring check (external scoring engine) on the detected video
      and shows a trust badge (e.g. "✓ Reviewed") — never a raw numeric score; tap-to-expand
      into plain-language scoring dimensions is optional.
- [ ] Parent reviews detected details + badge, then taps **Add Content** to confirm.
      **The score never gates Add Content** — even a low score, the parent can add it.
- [ ] Default state: **Private** — usable by this family immediately, no admin approval
      needed. The scoring check never delays private use.
- [ ] Toggle: "Also suggest this to other families" → integrates with the external Admin
      review queue (do not rebuild the queue/approval logic). Never changes this family's
      own instant private access either way.
- [ ] My Videos list: each entry supports **Remove** (long-press or "···" menu) — no
      edit-URL flow; a wrong link is removed and re-added.
- [ ] Library tagging renders one of: "Picked by [Parent name]" / "KidQ recommended" /
      "Admin-approved, suggested by [Parent name]".
- [ ] P9b (approved) and P9b-reject (not approved, neutral tone, no reason shown, Private
      status unaffected) render via the in-app inbox store (ticket 09) when the Admin
      queue signals a decision.
