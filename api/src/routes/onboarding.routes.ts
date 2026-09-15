import { Router } from "express";
import { createProfile } from "../controllers/onboarding.controller";
import { requireRole } from "../http/auth";

// GET /children is intentionally NOT mounted here — main's real, Postgres-backed
// GET /children (api/src/routes/parent.ts) already serves that exact path.
const router = Router();
router.post("/onboarding/profile", requireRole("parent", "admin"), createProfile);
export default router;
