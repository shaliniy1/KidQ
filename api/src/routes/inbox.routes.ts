import { Router } from "express";
import { getInbox, postMarkRead } from "../controllers/inbox.controller";
import { requireRole } from "../http/auth";

const router = Router();
router.get("/inbox", requireRole("parent", "admin"), getInbox);
router.post("/inbox/:notificationId/read", requireRole("parent", "admin"), postMarkRead);
export default router;
