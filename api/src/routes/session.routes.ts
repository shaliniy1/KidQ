import { Router } from "express";
import { postStartSession } from "../controllers/session.controller";
import { requireAuth } from "../middleware/require-auth";

const router = Router();
router.post("/children/:childId/session", requireAuth, postStartSession);
export default router;
