import { Router } from "express";
import { discover } from "../controllers/content.controller";

const router = Router();
router.get("/content/discover", (_req, res) => {
  res.json({
    message: "KidQ content discovery is ready. Use POST /content/discover with a JSON discovery request.",
    examples: {
      youtube: { source: "youtube", query: "calm counting for toddlers", max_results: 5 },
      open_web: { source: "open_web", query: "story", open_urls: ["https://example.org/story"] },
    },
  });
});
router.post("/content/discover", discover);
export default router;
