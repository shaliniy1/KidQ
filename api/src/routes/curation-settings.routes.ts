import { Router } from "express";
import { getSettings, putSettings } from "../controllers/curation-settings.controller";
import { requireAuth } from "../middleware/require-auth";

const router = Router();
router.get("/children/:childId/curation", requireAuth, getSettings);
router.put("/children/:childId/curation", requireAuth, putSettings);
export default router;
