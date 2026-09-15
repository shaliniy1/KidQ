export interface RecommendationCard {
  contentId: string;
  title: string;
  category: string | null;
  durationSeconds: number | null;
  thumbnailUrl: string | null;
  embedUrl: string | null;
  trustBadge: string;
  kidqSummary: string;
}
