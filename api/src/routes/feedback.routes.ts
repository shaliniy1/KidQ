import { Router } from "express";
import { getFeedback, postFeedback } from "../controllers/feedback.controller";
import { requireRole } from "../http/auth";

const router = Router();
router.post("/feedback", requireRole("parent", "admin"), postFeedback);
router.get("/feedback", requireRole("parent", "admin"), getFeedback);
export default router;
