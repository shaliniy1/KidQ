import { Router } from "express";
import { postCurationNlu } from "../controllers/curation-nlu.controller";
import { requireAuth } from "../middleware/require-auth";

const router = Router();
router.post("/nlu/curation", requireAuth, postCurationNlu);
export default router;
