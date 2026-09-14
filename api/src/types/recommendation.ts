export interface RecommendationCard {
  contentId: string;
  title: string;
  category: string | null;
  durationSeconds: number | null;
  thumbnailUrl: string | null;
  embedUrl: string | null;
  /** Never a raw numeric score (spec Section 11 #19) — see INTEGRATION_NOTES.md #5. */
  trustBadge: string;
  kidqSummary: string;
}
