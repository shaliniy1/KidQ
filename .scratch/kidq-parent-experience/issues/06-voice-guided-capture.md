# 06: Voice & guided capture shortcuts (P3-voice, P3-guided)

**What to build:** Two optional input shortcuts into the Hub's existing fields — a
"Talk or type to KidQ" voice/text capture screen, and a short tap-based guided-questions
wizard. Both fill the Hub's Interests/Content-mix/Regulation rows directly and return the
parent to the Hub to review — no separate "review what we extracted" screen.

**Blocked by:** 05 (Customize Hub)

**Status:** ready-for-agent

- [ ] "Talk or type to KidQ" screen: mic tap state machine (idle → listening → done);
      on-device browser speech-to-text produces the transcript client-side — only text
      ever leaves the client, no audio upload.
- [ ] Transcript (or typed text) is sent to the Voice-to-tag NLU API, which returns a
      best-effort mapping to Content Category / Interests / Regulation Goal.
- [ ] Whatever the NLU doesn't cover falls back to existing Hub defaults (Surprise-us
      content mix, all regulation goals) — no "please clarify" re-ask flow.
- [ ] Result writes directly into the Hub's fields; parent lands back on the Hub to review
      or adjust by tapping. Redoing voice input is a second attempt at capture, not a new
      screen.
- [ ] "Answer a few guided questions": two tap-to-select questions ("What does [child]
      enjoy more — stories or active play?" and "What matters most right now — calming
      down, focus, or energy?"); Continue enables once both are answered. The
      answer→tag mapping is a static client-side lookup — no backend call for this screen.
- [ ] Both shortcuts are reachable only from inside the Hub, alongside direct tap-through,
      not as a mandatory detour before it.
