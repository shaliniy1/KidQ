import { readAllContent } from "./content-store";
import { AGE_BANDS, type AgeBand } from "../types/parent-config";
import type { KidqContentRecord } from "../types/content";

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

export interface CandidateResult {
  candidates: KidqContentRecord[];
  usedFallback: boolean;
  fallbackCategory: string | null;
}

/**
 * PLACEHOLDER — see INTEGRATION_NOTES.md #4. Reads the same admin-approved
 * catalog the content-discovery pipeline already writes to
 * (content-store.ts); does NOT rank by relevance / KidQ Score / expert
 * review / parent preference — that ranking is the real content
 * scoring/recommendation engine's job (spec Table B #8, teammate-owned,
 * not yet callable from this repo). Ordering here is catalog-insertion
 * order only. Session Assembly (session-assembly.ts) consumes whatever
 * order it's given — swapping this adapter's internals for a real call to
 * the scoring engine requires no change on the assembly side, as long as
 * the return shape here stays the same.
 */
export async function getCandidates(query: CandidateQuery): Promise<CandidateResult> {
  const all = await readAllContent();
  const approved = all.filter((record) => record.content_status === "APPROVED");
  const excludeSet = new Set(query.excludeContentIds);

  const matchesCategory = (record: KidqContentRecord) =>
    !query.categories || (record.category !== null && query.categories.includes(record.category));
  const notExcluded = (record: KidqContentRecord) => !excludeSet.has(record.content_id);

  const primary = approved.filter(
    (record) => record.age_band.includes(query.ageBand) && matchesCategory(record) && notExcluded(record)
  );
  if (primary.length > 0) {
    return { candidates: primary, usedFallback: false, fallbackCategory: null };
  }

  // Bounded fallback: the immediately adjacent age band only, same
  // admin-approved catalog, never wider (spec Section 2 Rule 6).
  for (const adjacent of adjacentBands(query.ageBand)) {
    const fallback = approved.filter(
      (record) => record.age_band.includes(adjacent) && matchesCategory(record) && notExcluded(record)
    );
    if (fallback.length > 0) {
      return { candidates: fallback, usedFallback: true, fallbackCategory: fallback[0].category };
    }
  }

  return { candidates: [], usedFallback: false, fallbackCategory: null };
}
