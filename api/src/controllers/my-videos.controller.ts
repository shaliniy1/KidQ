import type { Request, Response } from "express";
import { extractYouTubeVideoId, fetchYouTubeMetadata, YouTubeNotConfiguredError } from "../services/youtube";
import { addToLibrary, getLibraryEntry, listLibrary, removeFromLibrary, setSubmissionStatus } from "../services/library-store";
import { addNotification } from "../services/inbox-store";
import { getParentExperienceConfig } from "../services/parent-config";
import type { LibraryVisibility } from "../types/library";

/**
 * "Other" is not part of the config-driven category list — it's the explicit
 * fallback a parent picks on P9a when none of KidQ's own categories fit
 * (spec/ticket 11 follow-up, 2026-09-15). Kept distinct from `null` so an
 * admin can tell "the parent deliberately said this doesn't fit any
 * category" apart from "never categorized." See INTEGRATION_NOTES.md #10 —
 * YouTube's own category taxonomy is never auto-mapped to this list.
 */
export const OTHER_CATEGORY = "Other";

/**
 * P9a step 1 — detects metadata for a pasted URL. Does NOT save anything
 * yet; the parent still has to review and tap Add Content (spec Section 7).
 */
export async function postDetectVideo(req: Request, res: Response) {
  const url = typeof req.body?.url === "string" ? req.body.url : "";
  const videoId = extractYouTubeVideoId(url);
  if (!videoId) {
    return res.status(400).json({ error: "Couldn't find a YouTube video in that URL" });
  }

  try {
    const metadata = await fetchYouTubeMetadata(videoId);
    return res.json({
      contentId: `yt-${metadata.videoId}`,
      title: metadata.title,
      channel: metadata.channel,
      thumbnailUrl: metadata.thumbnailUrl,
      durationSeconds: metadata.durationSeconds,
      embedUrl: `https://www.youtube.com/embed/${metadata.videoId}`,
      // PLACEHOLDER — see INTEGRATION_NOTES.md #5 (same gap as the P5 trust
      // badge: never a raw score, real per-dimension detail pending the
      // scoring engine).
      trustBadge: "Reviewed",
    });
  } catch (error) {
    if (error instanceof YouTubeNotConfiguredError) {
      return res.status(501).json({ error: error.message });
    }
    return res.status(502).json({ error: "Couldn't fetch that video's details" });
  }
}

export async function getMyVideos(req: Request, res: Response) {
  const entries = await listLibrary(req.identity!.uid);
  return res.json({ entries });
}

/** P9a "Add Content" — the score never gates this, and Private access is instant either way. */
export async function postAddVideo(req: Request, res: Response) {
  const { contentId, title, category, durationSeconds, thumbnailUrl, embedUrl, visibility } = req.body ?? {};
  if (typeof contentId !== "string" || !contentId || typeof title !== "string" || !title) {
    return res.status(400).json({ error: "contentId and title are required" });
  }

  // Category is picked by the parent on P9a (2026-09-15 follow-up) — YouTube
  // detection never auto-fills it (INTEGRATION_NOTES.md #10), so it's
  // required here just like contentId/title, validated against the same
  // config category list the Hub uses, plus the explicit "Other" escape hatch.
  const config = await getParentExperienceConfig();
  const validCategories = new Set([...config.categories, OTHER_CATEGORY]);
  if (typeof category !== "string" || !validCategories.has(category)) {
    return res.status(400).json({ error: "category must be one of the configured categories or 'Other'" });
  }

  const resolvedVisibility: LibraryVisibility = visibility === "public" ? "public" : "private";

  const [created] = await addToLibrary(req.identity!.uid, [
    {
      contentId,
      title,
      category,
      durationSeconds: typeof durationSeconds === "number" ? durationSeconds : null,
      thumbnailUrl: typeof thumbnailUrl === "string" ? thumbnailUrl : null,
      embedUrl: typeof embedUrl === "string" ? embedUrl : null,
      tag: "picked_by_parent",
      visibility: resolvedVisibility,
      submissionStatus: resolvedVisibility === "public" ? "pending" : "none",
    },
  ]);

  if (!created) {
    return res.status(409).json({ error: "This video is already in your library" });
  }
  return res.status(201).json({ entry: created });
}

export async function deleteVideo(req: Request, res: Response) {
  const removed = await removeFromLibrary(req.identity!.uid, req.params.entryId);
  if (!removed) return res.status(404).json({ error: "Library entry not found" });
  return res.status(204).send();
}

/**
 * PLACEHOLDER — see INTEGRATION_NOTES.md #6. Stands in for the real Admin
 * review queue (spec Table B #11, owned by the Admin flow, contract not
 * yet confirmed) exactly as ticket 11 instructs: "build and test the
 * parent-side UI against a stub/mocked queue until the contract is
 * available." A real integration would receive the decision as a webhook/
 * callback from the Admin flow, not a parent-triggered endpoint — this
 * lets the P9b/P9b-reject notification path be verified end-to-end now.
 */
export async function postSimulateAdminDecision(req: Request, res: Response) {
  const entry = await getLibraryEntry(req.identity!.uid, req.params.entryId);
  if (!entry) return res.status(404).json({ error: "Library entry not found" });
  if (entry.submissionStatus !== "pending") {
    return res.status(400).json({ error: "This entry has no pending public submission" });
  }

  const approved = req.body?.decision === "approved";
  const updated = await setSubmissionStatus(entry.id, approved ? "approved" : "rejected");

  const notification = await addNotification(
    req.identity!.uid,
    approved ? "submission_approved" : "submission_rejected",
    { title: entry.title }
  );

  return res.json({ entry: updated, notification });
}
