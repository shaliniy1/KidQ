import { Router } from "express";
import { getInbox, postMarkRead } from "../controllers/inbox.controller";
import { requireAuth } from "../middleware/require-auth";

const router = Router();
router.get("/inbox", requireAuth, getInbox);
router.post("/inbox/:notificationId/read", requireAuth, postMarkRead);
export default router;
