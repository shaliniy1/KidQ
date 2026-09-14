export type TimeRange = "day" | "week" | "month";

export interface CategoryTime {
  category: string;
  seconds: number;
}

export interface ContentSourceBreakdown {
  kidqRecommendedSeconds: number;
  pickedByParentSeconds: number;
  adminApprovedFromSubmissionSeconds: number;
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
