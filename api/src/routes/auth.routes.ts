import { Router } from "express";
import { createSession } from "../controllers/auth.controller";

const router = Router();
router.post("/auth/session", createSession);
export default router;
