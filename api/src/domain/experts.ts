// The expert line parents see (architecture doc §7): counts from KidQ-verified experts, and public
// reviews labelled as such, never implying credentials nobody checked. Kept separate from the score.
// Pure: no I/O.

export interface ExpertCounts {
  recommend: number;
  total: number;
  /** Reviews whose reviewer KidQ has verified. */
  verified: number;
  verifiedRecommend: number;
}

export function expertLabel(counts: ExpertCounts): string {
  if (counts.verified > 0) {
    const { verified, verifiedRecommend } = counts;
    if (verifiedRecommend === verified) return `Recommended by ${verified} KidQ expert${verified === 1 ? "" : "s"}`;
    return `${verifiedRecommend} of ${verified} KidQ experts recommend it`;
  }
  const plural = counts.total === 1 ? "" : "s";
  return counts.recommend === counts.total
    ? `Recommended in ${counts.total} public review${plural}`
    : `${counts.recommend} of ${counts.total} public reviews recommend it`;
}
