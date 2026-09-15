import { Router } from "express";
import { postCurationNlu } from "../controllers/curation-nlu.controller";
import { requireRole } from "../http/auth";

const router = Router();
router.post("/nlu/curation", requireRole("parent", "admin"), postCurationNlu);
export default router;
