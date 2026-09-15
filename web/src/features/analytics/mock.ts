// SAMPLE DATA ONLY — shown with a "Sample data" badge when the page has no API or parent token.
// Same shape as GET /children/:id/analytics; delete this file (and its import in services/analytics.ts)
// once the parent app signs in for real.
import type { ChildSummary, ParentAnalytics, Period } from "@/types/analytics";

export const MOCK_CHILDREN: ChildSummary[] = [
  { id: "sample-mia", nickname: "Mia" },
  { id: "sample-arjun", nickname: "Arjun" },
];

const WEEK = [35, 42, 28, 50, 30, 64, 42];
const CATEGORIES = [
  { key: "stories", label: "Stories", share: 32 },
  { key: "science", label: "Science", share: 24 },
  { key: "art_craft", label: "Creative activities", share: 18 },
  { key: "maths", label: "Maths", share: 12 },
  { key: "movement", label: "Yoga & movement", share: 8 },
  { key: "other", label: "Other", share: 6 },
];
const TITLES = [
  { title: "Animals Around Us", category: "science" },
  { title: "The Moon and Me", category: "stories" },
  { title: "Counting Clouds", category: "maths" },
  { title: "Paper Leaf Collage", category: "art_craft" },
  { title: "Stretch Like a Cat", category: "movement" },
];

function addDays(day: string, count: number) {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + count);
  return date.toISOString().slice(0, 10);
}

export function mockAnalytics(childId: string, period: Period): ParentAnalytics {
  const scale = childId === "sample-arjun" ? 0.7 : 1;
  const days = period === "today" ? 1 : period === "7d" ? 7 : 30;
  const factor = days / 7;
  const n = (value: number) => Math.round(value * factor * scale);
  const today = new Date().toISOString().slice(0, 10);
  const start = addDays(today, 1 - days);
  const daily = Array.from({ length: days }, (_, index) => ({ date: addDays(start, index), minutes: Math.round(WEEK[(index + 7 - days) % 7] * scale) }));
  const screen = daily.reduce((sum, day) => sum + day.minutes, 0);
  const activityMinutes = Math.round(screen * 0.39);
  const all = screen + activityMinutes;
  const categories = (childId === "sample-arjun" ? [CATEGORIES[1], CATEGORIES[0], ...CATEGORIES.slice(2)] : CATEGORIES).map(({ share, ...rest }) => ({
    ...rest,
    percent: share,
    minutes: Math.round((all * share) / 100),
  }));
  const started = Math.max(1, n(10));
  const completed = Math.round(started * 0.7);
  const partly = Math.round(started * 0.2);

  return {
    child_id: childId,
    period,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    range: { start, end: today },
    has_data: true,
    overview: {
      screen_minutes: screen,
      videos_watched: Math.max(1, n(6)),
      activities_completed: n(2),
      vs_previous: { minutes_diff: period === "today" ? -12 : n(-20), compared_with: period === "today" ? "yesterday" : period === "7d" ? "the week before" : "the 30 days before" },
    },
    daily,
    categories,
    engaged: [
      { key: categories[1].key, label: categories[1].label, minutes: n(42), videos: Math.max(1, n(6)), activities: 0, average_completion: 78 },
      { key: categories[0].key, label: categories[0].label, minutes: n(34), videos: Math.max(1, n(5)), activities: 0, average_completion: 83 },
      { key: "art_craft", label: "Creative activities", minutes: n(27), videos: 0, activities: Math.max(1, n(4)), average_completion: 90 },
    ],
    top_content: TITLES.map((item, index) => ({
      card: { id: `sample-${index}`, title: item.title, category: item.category, thumbnail_url: null, duration_seconds: 300 },
      minutes: Math.max(1, n(14 - index * 2)),
      completion: 92 - index * 6,
      times_watched: Math.max(1, 3 - Math.floor(index / 2)),
    })),
    completion: { started, completed, partly_watched: partly, stopped_early: started - completed - partly },
    pattern: [
      { part: "MORNING", label: "Morning", hours: "8 AM – 12 PM", minutes: Math.round(screen * 0.35) },
      { part: "AFTERNOON", label: "Afternoon", hours: "12 PM – 5 PM", minutes: Math.round(screen * 0.2) },
      { part: "EVENING", label: "Evening", hours: "5 PM – 9 PM", minutes: Math.round(screen * 0.4) },
      { part: "OTHER", label: "Other times", hours: "Before 8 AM or after 9 PM", minutes: Math.round(screen * 0.05) },
    ],
    split: { video_minutes: screen, activity_minutes: activityMinutes, video_percent: Math.round((screen / all) * 100), activity_percent: 100 - Math.round((screen / all) * 100) },
    insights: [`Seems to be engaging most with ${categories[1].label} ${period === "today" ? "today" : period === "7d" ? "this week" : "over the last 30 days"}.`, `Finished ${completed} of the ${started} videos they started.`],
  };
}
