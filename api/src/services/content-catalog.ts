import { getPool } from "../db/pool";
import { listApprovedCardRows, toCard } from "../repositories/content";
import { AGE_BANDS, type AgeBand } from "../types/parent-config";

function adjacentBands(band: AgeBand): AgeBand[] {
  const index = AGE_BANDS.indexOf(band);
  const adjacent: AgeBand[] = [];
  if (index > 0) adjacent.push(AGE_BANDS[index - 1]);
  if (index < AGE_BANDS.length - 1) adjacent.push(AGE_BANDS[index + 1]);
  return adjacent;
}

export interface CandidateQuery {
  ageBand: AgeBand;
  /** null = any category (Surprise-us); non-null = restrict to these (Let-me-choose mode). */
  categories: string[] | null;
  excludeContentIds: string[];
}

/**
 * The minimal shape Session Assembly (session-assembly.ts) actually needs from a candidate —
 * kept separate from the full admin-facing ContentCard (../repositories/content) so that shape
 * can keep changing for the admin app without ever touching Session Assembly.
 */
export interface SessionCandidate {
  content_id: string;
  title: string;
  category: string | null;
  duration_seconds: number | null;
  embed_url: string | null;
  thumbnail_url: string | null;
  age_band: AgeBand[];
}

export interface CandidateResult {
  candidates: SessionCandidate[];
  usedFallback: boolean;
  fallbackCategory: string | null;
}

/**
 * Real admin-approved catalog (Postgres, via the shared content repository) -> Session
 * Assembly's candidate shape. Only items with an actual watchable video embed are eligible —
 * this pipeline assembles a queue of videos to play, not the story reader, so a storybook (or
 * anything with no working player) is excluded here rather than passed through with a null URL.
 *
 * Note the age-band key format differs between the two sides: the repository's bands are
 * "0_2".."5_6" (underscore), while everything in the parent-screens code (this file, the
 * curation-settings/session-assembly types, onboarding) uses "0-2".."5-6" (hyphen) — converted
 * here so every existing comparison downstream keeps working unchanged.
 */
export async function loadApprovedCandidates(): Promise<SessionCandidate[]> {
  const rows = await listApprovedCardRows(getPool());
  const candidates: SessionCandidate[] = [];
  for (const row of rows) {
    const card = toCard(row);
    const embedUrl =
      card.player?.provider === "youtube"
        ? card.player.embed_url
        : card.player?.provider === "html5"
          ? card.player.media_url
          : null;
    if (!embedUrl) continue; // no watchable video (e.g. a storybook, or missing media)
    candidates.push({
      content_id: card.id,
      title: card.title,
      category: card.category,
      duration_seconds: card.duration_seconds,
      embed_url: embedUrl,
      thumbnail_url: card.thumbnail_url,
      age_band: card.age.groups.map((group) => group.replace("_", "-")) as AgeBand[],
    });
  }
  return candidates;
}

/**
 * Ordering here is catalog order only — does NOT rank by relevance / KidQ Score / expert
 * review / parent preference — that ranking is the real content scoring/recommendation
 * engine's job (spec Table B #8). Session Assembly consumes whatever order it's given, so
 * swapping this function's internals for a real ranked call requires no change on its side.
 */
export async function getCandidates(query: CandidateQuery): Promise<CandidateResult> {
  const approved = await loadApprovedCandidates();
  const excludeSet = new Set(query.excludeContentIds);

  const matchesCategory = (candidate: SessionCandidate) =>
    !query.categories || (candidate.category !== null && query.categories.includes(candidate.category));
  const notExcluded = (candidate: SessionCandidate) => !excludeSet.has(candidate.content_id);

  const primary = approved.filter(
    (candidate) => candidate.age_band.includes(query.ageBand) && matchesCategory(candidate) && notExcluded(candidate)
  );
  if (primary.length > 0) {
    return { candidates: primary, usedFallback: false, fallbackCategory: null };
  }

  // Bounded fallback: the immediately adjacent age band only, same
  // admin-approved catalog, never wider (spec Section 2 Rule 6).
  for (const adjacent of adjacentBands(query.ageBand)) {
    const fallback = approved.filter(
      (candidate) => candidate.age_band.includes(adjacent) && matchesCategory(candidate) && notExcluded(candidate)
    );
    if (fallback.length > 0) {
      return { candidates: fallback, usedFallback: true, fallbackCategory: fallback[0].category };
    }
  }

  return { candidates: [], usedFallback: false, fallbackCategory: null };
}
