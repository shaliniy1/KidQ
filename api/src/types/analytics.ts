export type TimeRange = "day" | "week" | "month";

export interface CategoryTime {
  category: string;
  seconds: number;
}

export interface ContentSourceBreakdown {
  kidqRecommendedSeconds: number;
  pickedByParentSeconds: number;
  adminApprovedFromSubmissionSeconds: number;
  /**
   * % of watched time tagged kidq_recommended or admin_approved_from_submission
   * (i.e. came from KidQ's own curated catalog) vs picked_by_parent (private,
   * parent's own pick). Computed from real library-tag data, not from the
   * scoring engine's per-dimension detail (which doesn't exist yet — see
   * INTEGRATION_NOTES.md #5). Named for what it actually measures (source,
   * not a scoring-engine pass/fail result) after a 2026-09-15 review found
   * "% KidQ-reviewed" overclaimed a scoring-engine join that isn't happening.
   */
  percentFromKidqCuratedSources: number;
}

export interface AnalyticsSummary {
  childId: string;
  range: TimeRange;
  sessionCount: number;
  totalScreenTimeSeconds: number;
  categoryBreakdown: CategoryTime[];
  completionRatePercent: number;
  earlyExitRatePercent: number;
  contentSource: ContentSourceBreakdown;
}
