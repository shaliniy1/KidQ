import { Router } from "express";
import { getWatchedLog, postSessionLog } from "../controllers/session-log.controller";
import { requireRole } from "../http/auth";

const router = Router();
router.post("/children/:childId/session-log", requireRole("parent", "admin"), postSessionLog);
router.get("/children/:childId/watched-log", requireRole("parent", "admin"), getWatchedLog);
export default router;
