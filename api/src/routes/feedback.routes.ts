import { Router } from "express";
import { getFeedback, postFeedback } from "../controllers/feedback.controller";
import { requireAuth } from "../middleware/require-auth";

const router = Router();
router.post("/feedback", requireAuth, postFeedback);
router.get("/feedback", requireAuth, getFeedback);
export default router;
