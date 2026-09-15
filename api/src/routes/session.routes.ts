import { Router } from "express";
import { getSyncStatusForChild, postStartSession, postSyncAck } from "../controllers/session.controller";
import { requireRole } from "../http/auth";

const router = Router();
router.post("/children/:childId/session", requireRole("parent", "admin"), postStartSession);
router.post("/children/:childId/sync-ack", requireRole("parent", "admin"), postSyncAck);
router.get("/children/:childId/sync-status", requireRole("parent", "admin"), getSyncStatusForChild);
export default router;
