import { Router } from "express";
import { getExcludeList, postExclude } from "../controllers/exclude-list.controller";
import { requireAuth } from "../middleware/require-auth";

const router = Router();
router.get("/children/:childId/exclude", requireAuth, getExcludeList);
router.post("/children/:childId/exclude", requireAuth, postExclude);
export default router;
