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
   * (i.e. went through some form of KidQ curation) vs picked_by_parent
   * (private, parent's own pick). Computed from real library-tag data, not
   * from the scoring engine's per-dimension detail (which doesn't exist
   * yet — see INTEGRATION_NOTES.md #5) — a defensible, real proxy for
   * "how much of what they watched was KidQ-reviewed" (spec Section 11 #19),
   * not a placeholder needing disclosure.
   */
  percentKidqReviewed: number;
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
