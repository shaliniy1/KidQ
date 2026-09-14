import { Router } from "express";
import { createProfile, getChildren } from "../controllers/onboarding.controller";
import { requireAuth } from "../middleware/require-auth";

const router = Router();
router.post("/onboarding/profile", requireAuth, createProfile);
router.get("/children", requireAuth, getChildren);
export default router;
