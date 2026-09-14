import { Router } from "express";
import { createSession } from "../controllers/auth.controller";
import { requireAuth } from "../middleware/require-auth";

const router = Router();
router.post("/auth/session", requireAuth, createSession);
export default router;
