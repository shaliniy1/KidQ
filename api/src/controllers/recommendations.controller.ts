import type { Request, Response } from "express";
import { assertChildOwnedBy } from "../services/child-profile-store";
import { getCurationSettings } from "../services/curation-settings-store";
import { getCandidates } from "../services/content-catalog";
import { addToLibrary } from "../services/library-store";
import type { RecommendationCard } from "../types/recommendation";
import type { KidqContentRecord } from "../types/content";

/**
 * PLACEHOLDER — see INTEGRATION_NOTES.md #5. The real trust badge and its
 * tap-to-expand scoring-dimension detail (pacing/language/content/visual/
 * audio, spec Section 11 #19) come from the same content scoring engine
 * Session Assembly is waiting on (ticket 07 / INTEGRATION_NOTES.md #4) —
 * not yet callable. Every APPROVED catalog record gets a plain "Reviewed"
 * badge here (true of the underlying data — these genuinely are marked
 * approved — but not a real per-dimension score), and the expanded detail
 * says so explicitly rather than fabricating plausible-looking numbers.
 */
function toCard(record: KidqContentRecord): RecommendationCard {
  return {
    contentId: record.content_id,
    title: record.title,
    category: record.category,
    durationSeconds: record.duration_seconds,
    thumbnailUrl: record.thumbnail_url,
    embedUrl: record.embed_url,
    trustBadge: "Reviewed",
    kidqSummary: record.kidq_summary,
  };
}

export async function getRecommendations(req: Request, res: Response) {
  const childId = req.params.childId;
  const child = await assertChildOwnedBy(childId, req.identity!.uid);
  if (!child) return res.status(404).json({ error: "Child not found" });

  const settings = await getCurationSettings(childId);
  const restrictCategories = settings.contentMixMode === "choose_categories" ? settings.contentMixCategories : null;
  const { candidates } = await getCandidates({ ageBand: child.ageBand, categories: restrictCategories, excludeContentIds: [] });

  return res.json({ cards: candidates.map(toCard) });
}

export async function postAddToLibrary(req: Request, res: Response) {
  const childId = req.params.childId;
  const child = await assertChildOwnedBy(childId, req.identity!.uid);
  if (!child) return res.status(404).json({ error: "Child not found" });

  const contentIds = req.body?.contentIds;
  if (!Array.isArray(contentIds) || contentIds.length === 0) {
    return res.status(400).json({ error: "contentIds must be a non-empty array" });
  }

  const settings = await getCurationSettings(childId);
  const restrictCategories = settings.contentMixMode === "choose_categories" ? settings.contentMixCategories : null;
  const { candidates } = await getCandidates({ ageBand: child.ageBand, categories: restrictCategories, excludeContentIds: [] });
  const selected = candidates.filter((candidate) => contentIds.includes(candidate.content_id));

  const added = await addToLibrary(
    req.identity!.uid,
    selected.map((record) => ({
      contentId: record.content_id,
      title: record.title,
      category: record.category,
      durationSeconds: record.duration_seconds,
      thumbnailUrl: record.thumbnail_url,
      embedUrl: record.embed_url,
      tag: "kidq_recommended" as const,
      // KidQ-recommended entries never go through the parent Public-submission
      // workflow (that's picked_by_parent-only, ticket 11) — no visibility/
      // submission state applies to them.
      visibility: "private" as const,
      submissionStatus: "none" as const,
    }))
  );

  return res.json({ added });
}
