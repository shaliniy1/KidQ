import { Router } from "express";
import { createConsent, getConsentStatus } from "../controllers/consent.controller";
import { requireAuth } from "../middleware/require-auth";

const router = Router();
router.get("/consent", requireAuth, getConsentStatus);
router.post("/consent", requireAuth, createConsent);
export default router;
