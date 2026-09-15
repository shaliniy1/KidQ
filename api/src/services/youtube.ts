/**
 * Real YouTube Data API v3 integration, gated behind YOUTUBE_DATA_API_KEY
 * (see api/.env.example) — same pattern as Firebase Admin (T02): a real
 * call, not a fake stand-in, that fails clearly when unconfigured rather
 * than fabricating video metadata. Fetch fields match the existing
 * config/content-sources.json policy (official API only, never scrape).
 */
export class YouTubeNotConfiguredError extends Error {
  constructor() {
    super("YouTube Data API is not configured — set YOUTUBE_DATA_API_KEY (see api/.env.example).");
    this.name = "YouTubeNotConfiguredError";
  }
}

export interface YouTubeVideoMetadata {
  videoId: string;
  title: string;
  channel: string | null;
  thumbnailUrl: string | null;
  durationSeconds: number | null;
}

const URL_PATTERNS = [
  /(?:youtube\.com\/watch\?v=)([\w-]{11})/,
  /(?:youtu\.be\/)([\w-]{11})/,
  /(?:youtube\.com\/embed\/)([\w-]{11})/,
];

export function extractYouTubeVideoId(url: string): string | null {
  for (const pattern of URL_PATTERNS) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

function parseIso8601Duration(iso: string): number | null {
  const match = iso.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);
  if (!match) return null;
  const [, hours, minutes, seconds] = match;
  return Number(hours || 0) * 3600 + Number(minutes || 0) * 60 + Number(seconds || 0);
}

export async function fetchYouTubeMetadata(videoId: string): Promise<YouTubeVideoMetadata> {
  const apiKey = process.env.YOUTUBE_DATA_API_KEY;
  if (!apiKey) throw new YouTubeNotConfiguredError();

  const url = new URL("https://www.googleapis.com/youtube/v3/videos");
  url.searchParams.set("part", "snippet,contentDetails");
  url.searchParams.set("id", videoId);
  url.searchParams.set("key", apiKey);

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`YouTube API request failed with status ${res.status}`);
  }
  const data = (await res.json()) as {
    items?: Array<{
      snippet: { title: string; channelTitle?: string; thumbnails?: Record<string, { url: string }> };
      contentDetails: { duration: string };
    }>;
  };
  const item = data.items?.[0];
  if (!item) {
    throw new Error("No video found for that URL");
  }

  const thumbnail =
    item.snippet.thumbnails?.high?.url ?? item.snippet.thumbnails?.medium?.url ?? item.snippet.thumbnails?.default?.url ?? null;

  return {
    videoId,
    title: item.snippet.title,
    channel: item.snippet.channelTitle ?? null,
    thumbnailUrl: thumbnail,
    durationSeconds: parseIso8601Duration(item.contentDetails.duration),
  };
}
