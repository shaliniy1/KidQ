import { Router } from "express";
import { createConsent, getConsentStatus } from "../controllers/consent.controller";
import { requireRole } from "../http/auth";

const router = Router();
router.get("/consent", requireRole("parent", "admin"), getConsentStatus);
router.post("/consent", requireRole("parent", "admin"), createConsent);
export default router;
