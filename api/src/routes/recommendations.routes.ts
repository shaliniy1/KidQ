import { Router } from "express";
import { getRecommendations, postAddToLibrary } from "../controllers/recommendations.controller";
import { requireAuth } from "../middleware/require-auth";

const router = Router();
router.get("/children/:childId/recommendations", requireAuth, getRecommendations);
router.post("/children/:childId/library", requireAuth, postAddToLibrary);
export default router;
