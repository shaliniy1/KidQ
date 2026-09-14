import { Router } from "express";
import { postSessionLog } from "../controllers/session-log.controller";
import { requireAuth } from "../middleware/require-auth";

const router = Router();
router.post("/children/:childId/session-log", requireAuth, postSessionLog);
export default router;
