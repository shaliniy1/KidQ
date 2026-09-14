import { Router } from "express";
import { getWatchedLog, postSessionLog } from "../controllers/session-log.controller";
import { requireAuth } from "../middleware/require-auth";

const router = Router();
router.post("/children/:childId/session-log", requireAuth, postSessionLog);
router.get("/children/:childId/watched-log", requireAuth, getWatchedLog);
export default router;
