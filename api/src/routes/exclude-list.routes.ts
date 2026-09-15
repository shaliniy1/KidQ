import { Router } from "express";
import { getExcludeList, postExclude } from "../controllers/exclude-list.controller";
import { requireRole } from "../http/auth";

const router = Router();
router.get("/children/:childId/exclude", requireRole("parent", "admin"), getExcludeList);
router.post("/children/:childId/exclude", requireRole("parent", "admin"), postExclude);
export default router;
