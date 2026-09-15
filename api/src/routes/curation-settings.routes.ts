import { Router } from "express";
import { getSettings, putSettings } from "../controllers/curation-settings.controller";
import { requireRole } from "../http/auth";

const router = Router();
router.get("/children/:childId/curation", requireRole("parent", "admin"), getSettings);
router.put("/children/:childId/curation", requireRole("parent", "admin"), putSettings);
export default router;
