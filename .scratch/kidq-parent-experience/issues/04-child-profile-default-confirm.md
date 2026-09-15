# 04: Child profile + default confirm (P2-mandatory / P2-confirm)

**What to build:** The two mandatory onboarding screens: capture parent name and each
child's nickname/age band (with auto-assigned mascot color), then show the age-derived
default confirmation with the three coequal top-level choices (Start using KidQ /
Customize / Browse and pick myself).

**Blocked by:** 03 (DPDP consent gate)

**Status:** ready-for-agent

- [ ] Screen 1: parent name (required), child-count stepper bounded 1–6 (default 1), and
      per child: nickname (free text, never legal name) and age band picker
      (0-2/2-3/3-4/4-5/5-6). Continue stays disabled until all required fields are filled.
- [ ] Each child gets a mascot color auto-cycled through the 5 brand accents (teal,
      saffron, terracotta, mango, lavender) in add order; changeable with one tap on
      Screen 1. Not tied to gender.
- [ ] Backend Child profile store persists nickname, age band, mascot color per child.
- [ ] Screen 2 (P2-confirm) renders the spec-exact copy "We've set up [Child]'s KidQ using
      just their age. Start right away, or fine-tune it below." — this copy string is the
      full extent of what's shown; it does not display Development-Goal or content-mix
      values, since spec Section 1 Block C and Section 11 #14 require Development Goal to
      stay hidden from the parent everywhere. (Corrected 2026-09-15 — the original wording
      here implied fetching/rendering actual age-derived default values on this screen,
      which would have conflicted with that hidden-goal requirement.)
- [ ] Three coequal actions render: `Start using KidQ` (primary, → P7a), `Customize for
      {child}` (secondary, → Hub, ticket 05), `Browse and pick myself` (tertiary, → P5,
      ticket 08) — none of the three routes through a P3 gatekeeping detour.
- [ ] Age-band silently and automatically updates in the background when a child's age
      crosses a band boundary — no parent prompt, no visible transition.
- [ ] Back navigation: P2 screens back to the previous P2 step, ultimately back to P1.
