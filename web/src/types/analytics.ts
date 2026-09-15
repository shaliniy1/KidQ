// Mirrors the API's ParentAnalytics schema and event bodies (api/src/http/schemas.ts, "Analytics").
// web has no generated client yet; when it gets one, replace this file with the generated types.

export type Period = "today" | "7d" | "30d";
export type RecommendationSource = "PARENT_PLAYLIST" | "KIDQ_RECOMMENDATION" | "CATEGORY_BROWSE" | "CONTINUE_WATCHING" | "RECENTLY_WATCHED";
export type DeviceType = "PHONE" | "TABLET" | "TV" | "DESKTOP";

export interface ChildSummary {
  id: string;
  nickname: string;
}

/** The ContentCard fields this page uses. */
export interface ContentCardSummary {
  id: string;
  title: string;
  category: string | null;
  thumbnail_url: string | null;
  duration_seconds: number | null;
}

export interface ParentAnalytics {
  child_id: string;
  period: Period;
  timezone: string;
  range: { start: string; end: string };
  has_data: boolean;
  overview: {
    screen_minutes: number;
    videos_watched: number;
    activities_completed: number;
    vs_previous: { minutes_diff: number; compared_with: string } | null;
  };
  daily: { date: string; minutes: number }[];
  categories: { key: string; label: string; minutes: number; percent: number }[];
  engaged: { key: string; label: string; minutes: number; videos: number; activities: number; average_completion: number }[];
  top_content: { card: ContentCardSummary; minutes: number; completion: number; times_watched: number }[];
  completion: { started: number; completed: number; partly_watched: number; stopped_early: number };
  pattern: { part: "MORNING" | "AFTERNOON" | "EVENING" | "OTHER"; label: string; hours: string; minutes: number }[];
  split: { video_minutes: number; activity_minutes: number; video_percent: number; activity_percent: number };
  insights: string[];
}

type Base = { client_event_id: string; occurred_at: string; session_id?: string };
type VideoBase = Base & { content_id: string; play_id: string };
type Position = { position_seconds: number; progress_percent: number };
type Active = { active_seconds: number };

export type AnalyticsEvent =
  | (VideoBase & { event_name: "video_started"; recommendation_source?: RecommendationSource })
  | (VideoBase & Position & Active & { event_name: "video_progress" | "video_paused" | "video_completed" | "video_exited" })
  | (VideoBase & { event_name: "video_resumed"; position_seconds: number; pause_duration_seconds: number })
  | (VideoBase & { event_name: "video_replayed" })
  | (Base & { event_name: "content_clicked"; content_id: string; position: number; recommendation_source: RecommendationSource })
  | (Base & { event_name: "recommendation_clicked"; content_id: string; position: number; recommendation_reason: string })
  | (Base & { event_name: "session_started"; session_id: string; device_type: DeviceType })
  | (Base & { event_name: "session_ended"; session_id: string })
  | (Base & { event_name: "activity_started"; activity_id: string; play_id: string })
  | (Base & Active & { event_name: "activity_completed"; activity_id: string; play_id: string });

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;
/** An event before it's stamped with its id and time. */
export type TrackableEvent = DistributiveOmit<AnalyticsEvent, "client_event_id" | "occurred_at">;
