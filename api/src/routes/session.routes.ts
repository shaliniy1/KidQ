import { Router } from "express";
import { getSyncStatusForChild, postStartSession, postSyncAck } from "../controllers/session.controller";
import { requireAuth } from "../middleware/require-auth";

const router = Router();
router.post("/children/:childId/session", requireAuth, postStartSession);
router.post("/children/:childId/sync-ack", requireAuth, postSyncAck);
router.get("/children/:childId/sync-status", requireAuth, getSyncStatusForChild);
export default router;
