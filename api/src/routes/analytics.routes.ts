import { Router } from "express";
import { getAnalyticsCsvExport, getAnalyticsSummary } from "../controllers/analytics.controller";
import { requireAuth } from "../middleware/require-auth";

const router = Router();
router.get("/children/:childId/analytics", requireAuth, getAnalyticsSummary);
router.get("/analytics/export.csv", requireAuth, getAnalyticsCsvExport);
export default router;
