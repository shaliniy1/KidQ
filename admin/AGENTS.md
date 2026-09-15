# KidQ Admin UI

Use this file when changing the `admin/` application.

## Product priority

Design for one fast path: find content, confirm its category and age group, review it, then publish it or request changes. Keep content thumbnails and titles visually dominant. Use plain language and keep system details behind optional disclosure.

## Navigation and visual language

- Keep the header compact with the KidQ name and current temporary Q mark.
- Use the existing warm cream, muted coral, sage, and dark green palette.
- Use compact oval hover and active states for navigation; an active item must not stretch the header.
- Preserve the refined Avenir-first typography, generous spacing, soft borders, and restrained shadows.
- Treat Browse all content, Add new content, and Open review list as primary calls to action.

## Content model in the UI

- Category is the admin-facing classification. Do not present Content type beside Category as a duplicate field.
- Show thumbnail, title, creator, category, age group, duration, and plain-language status in content lists.
- Use these overview groups and map every record into exactly one:
  - Pending review: `PENDING_ANALYSIS`
  - Review in progress: `ANALYSING` and `ANALYSIS_INCOMPLETE`
  - Needs changes: `NEEDS_ATTENTION`, `FAILED`, and `REJECTED`
  - Needs confirmation: `READY_TO_APPROVE`
  - Published: `APPROVED`
- Keep the review CTA explicit: content is waiting for review, and the action opens the review list.

## Add Content

- Keep Video links, Upload PDF, and Discover as tabs in one focused workspace.
- Show Category and Age group inside every method instead of in a separate advanced section.
- The PDF method also shows age range breakpoints and a cover-image picker.
- Stage selected links or files before adding them and refresh the fetched-content total after a completed import.
- Durable PDF saving requires configured file storage. Keep unavailable actions honest rather than simulating a successful upload.

## Completion

For every admin UI change, run the admin typecheck and production build, then inspect the affected pages at narrow and desktop-responsive layouts. The change is complete when labels, counts, active navigation, primary actions, and form alignment are visibly correct.
