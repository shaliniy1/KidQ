import { Router } from "express";
import { getAnalyticsSummary } from "../controllers/analytics.controller";
import { requireAuth } from "../middleware/require-auth";

const router = Router();
router.get("/children/:childId/analytics", requireAuth, getAnalyticsSummary);
export default router;
