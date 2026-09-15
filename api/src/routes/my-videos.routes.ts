import { Router } from "express";
import {
  deleteVideo,
  getMyVideos,
  postAddVideo,
  postDetectVideo,
  postSimulateAdminDecision,
} from "../controllers/my-videos.controller";
import { requireRole } from "../http/auth";

const router = Router();
router.post("/videos/detect", requireRole("parent", "admin"), postDetectVideo);
router.get("/library", requireRole("parent", "admin"), getMyVideos);
router.post("/library", requireRole("parent", "admin"), postAddVideo);
router.delete("/library/:entryId", requireRole("parent", "admin"), deleteVideo);
router.post("/library/:entryId/simulate-admin-decision", requireRole("parent", "admin"), postSimulateAdminDecision);
export default router;
