import { Router } from "express";
import {
  deleteVideo,
  getMyVideos,
  postAddVideo,
  postDetectVideo,
  postSimulateAdminDecision,
} from "../controllers/my-videos.controller";
import { requireAuth } from "../middleware/require-auth";

const router = Router();
router.post("/videos/detect", requireAuth, postDetectVideo);
router.get("/library", requireAuth, getMyVideos);
router.post("/library", requireAuth, postAddVideo);
router.delete("/library/:entryId", requireAuth, deleteVideo);
router.post("/library/:entryId/simulate-admin-decision", requireAuth, postSimulateAdminDecision);
export default router;
