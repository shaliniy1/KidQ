# 15: Sync / device-status reporting (backend-only)

**What to build:** Tracking of whether a rule or an updated session queue has actually
reached the child's device, so the system (and, longer-term, reporting) can tell "saved"
from "synced."

**Blocked by:** 07 (Start a Session)

**Status:** ready-for-agent

- [ ] Backend records, per child device, whether the most recent assembled session queue
      / curation rule update has been acknowledged as received by the device.
- [ ] No new parent-facing screen in this ticket; this is the data layer named in
      `kidQ Design.md` §5.5 as a reporting need, available for a future status indicator.
- [ ] Verify by starting a session (ticket 07) and confirming the sync/device-status
      record flips from pending → acknowledged once the child device has the queue.
