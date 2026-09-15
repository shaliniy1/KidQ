// YouTube connector — official YouTube Data API only (README "YouTube connector").
// Never scrapes pages, downloads video/audio, or uses unofficial transcript endpoints.
import { env } from "../config/env";
import { fetchJson, HttpError } from "./http";
import { MAX_VIDEO_SECONDS, type Connector, type ConnectorBatch, type DiscoveryHints, type DiscoveryQuery, type NormalizedRecord } from "./types";

const API = "https://www.googleapis.com/youtube/v3";
export const YOUTUBE_CONNECTOR_VERSION = "2";
const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;

interface YouTubeVideo {
  id: string;
  snippet?: {
    title?: string;
    description?: string;
    channelTitle?: string;
    thumbnails?: Record<string, { url: string }>;
    tags?: string[];
    defaultLanguage?: string;
    defaultAudioLanguage?: string;
    liveBroadcastContent?: string;
  };
  contentDetails?: { duration?: string; caption?: string };
  status?: { privacyStatus?: string; embeddable?: boolean; license?: string; madeForKids?: boolean };
  topicDetails?: { topicCategories?: string[] };
}

/** Accepts watch, youtu.be, shorts, embed and nocookie URLs, or a bare 11-character id. */
export function parseYouTubeId(input: string): string | null {
  const trimmed = input.trim();
  if (VIDEO_ID.test(trimmed)) return trimmed;
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }
  const host = url.hostname.replace(/^(www\.|m\.|music\.)/, "");
  let candidate: string | null = null;
  if (host === "youtu.be") candidate = url.pathname.slice(1).split("/")[0];
  if (host === "youtube.com" || host === "youtube-nocookie.com") {
    candidate = url.pathname === "/watch" ? url.searchParams.get("v") : (url.pathname.match(/^\/(?:embed|shorts|live|v)\/([^/?#]+)/)?.[1] ?? null);
  }
  return candidate && VIDEO_ID.test(candidate) ? candidate : null;
}

export function parseIsoDuration(value?: string): number | null {
  const match = value?.match(/^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/);
  if (!match) return null;
  return Number(match[1] ?? 0) * 86_400 + Number(match[2] ?? 0) * 3_600 + Number(match[3] ?? 0) * 60 + Number(match[4] ?? 0);
}

function apiKey(): string {
  if (!env.youtubeApiKey) throw new HttpError(0, "YOUTUBE_DATA_API_KEY is not configured; KidQ never scrapes YouTube.", false);
  return env.youtubeApiKey;
}

function rejectReason(video: YouTubeVideo | undefined): string | null {
  if (!video) return "REJECTED_UNAVAILABLE";
  if (video.status?.privacyStatus && video.status.privacyStatus !== "public") return "REJECTED_NOT_PUBLIC";
  if (video.status?.embeddable === false) return "REJECTED_NOT_EMBEDDABLE";
  if (video.snippet?.liveBroadcastContent && video.snippet.liveBroadcastContent !== "none") return "REJECTED_LIVE";
  const duration = parseIsoDuration(video.contentDetails?.duration);
  if (duration !== null && duration > MAX_VIDEO_SECONDS) return "REJECTED_TOO_LONG";
  return null;
}

function topicName(topicUrl: string) {
  return decodeURIComponent(topicUrl.split("/").pop() ?? "").replace(/_/g, " ");
}

export function toYouTubeRecord(video: YouTubeVideo, hints: DiscoveryHints = {}, fallbackLanguage?: string): NormalizedRecord {
  const snippet = video.snippet ?? {};
  const thumbnails = Object.fromEntries(Object.entries(snippet.thumbnails ?? {}).map(([size, thumb]) => [size, thumb.url]));
  const embeddable = video.status?.embeddable ?? null;
  const creativeCommons = video.status?.license === "creativeCommon";
  return {
    sourceSystemId: "youtube",
    externalId: video.id,
    sourceUrl: `https://www.youtube.com/watch?v=${video.id}`,
    embedUrl: `https://www.youtube.com/embed/${video.id}`,
    mediaUrl: null,
    mediaMimeType: null,
    title: snippet.title ?? video.id,
    description: snippet.description || null,
    creator: snippet.channelTitle ?? null,
    thumbnails,
    thumbnailUrl: thumbnails.high ?? thumbnails.medium ?? thumbnails.default ?? null,
    durationSeconds: parseIsoDuration(video.contentDetails?.duration),
    language: snippet.defaultAudioLanguage ?? snippet.defaultLanguage ?? fallbackLanguage ?? null,
    captionAvailable: video.contentDetails?.caption === "true",
    madeForKids: video.status?.madeForKids ?? null,
    embeddable,
    tags: [...(snippet.tags ?? []), ...(video.topicDetails?.topicCategories ?? []).map(topicName)],
    contentType: "VIDEO",
    rights: {
      licenseName: creativeCommons ? "Creative Commons Attribution (YouTube)" : "Standard YouTube License",
      licenseUrl: creativeCommons ? "https://creativecommons.org/licenses/by/3.0/legalcode" : "https://www.youtube.com/t/terms",
      attributionText: snippet.channelTitle ? `${snippet.channelTitle} on YouTube` : null,
      attributionRequired: creativeCommons ? true : null,
      allowsEmbedding: embeddable,
      allowsMetadataStorage: true,
      allowsThumbnailStorage: false,
      allowsTranscriptStorage: false,
      allowsMediaStorage: false,
      allowsAdaptation: creativeCommons ? true : false,
      allowsCommercialUse: creativeCommons ? true : null,
      evidenceUrl: `https://www.youtube.com/watch?v=${video.id}`,
      evidenceText: `YouTube Data API status: license=${video.status?.license ?? "unknown"}, embeddable=${embeddable}, madeForKids=${video.status?.madeForKids ?? "unknown"}.`,
    },
    rawMetadata: video,
    hints,
  };
}

/** videos.list in batches of 50; drops unavailable, private, live, non-embeddable and over-long videos. */
export async function fetchYouTubeVideos(ids: string[], hints: DiscoveryHints = {}, language?: string): Promise<ConnectorBatch> {
  const key = apiKey();
  const unique = [...new Set(ids)];
  const batch: ConnectorBatch = { records: [], rejected: 0, seen: unique.length, errors: [] };
  for (let start = 0; start < unique.length; start += 50) {
    const chunk = unique.slice(start, start + 50);
    const params = new URLSearchParams({ part: "snippet,contentDetails,status,topicDetails", id: chunk.join(","), maxResults: "50", key });
    const response = await fetchJson<{ items?: YouTubeVideo[] }>(`${API}/videos?${params}`);
    const returned = new Map((response.items ?? []).map((video) => [video.id, video]));
    for (const id of chunk) {
      const video = returned.get(id);
      const reason = rejectReason(video);
      if (reason || !video) {
        batch.rejected += 1;
        batch.errors.push({ externalId: id, code: reason ?? "REJECTED_UNAVAILABLE", message: "Dropped before storage by YouTube status checks.", retryable: false });
        continue;
      }
      batch.records.push(toYouTubeRecord(video, hints, language));
    }
  }
  return batch;
}

async function searchIds(query: DiscoveryQuery): Promise<string[]> {
  const key = apiKey();
  const ids: string[] = [];
  let pageToken: string | undefined;
  while (ids.length < query.maxResults) {
    // Relevance order only: never rank by views, likes, subscribers or trending (README).
    const params = new URLSearchParams({
      part: "snippet",
      type: "video",
      safeSearch: "strict",
      videoEmbeddable: "true",
      order: "relevance",
      q: query.query,
      maxResults: String(Math.min(50, query.maxResults - ids.length)),
      key,
    });
    if (query.regionCode) params.set("regionCode", query.regionCode);
    if (query.language) params.set("relevanceLanguage", query.language);
    if (query.channelId) params.set("channelId", query.channelId);
    if (pageToken) params.set("pageToken", pageToken);
    const page = await fetchJson<{ items?: Array<{ id?: { videoId?: string } }>; nextPageToken?: string }>(`${API}/search?${params}`);
    for (const item of page.items ?? []) {
      const videoId = item.id?.videoId;
      if (videoId && !ids.includes(videoId)) ids.push(videoId);
    }
    pageToken = page.nextPageToken;
    if (!pageToken || !page.items?.length) break;
  }
  return ids.slice(0, query.maxResults);
}

export const youtubeConnector: Connector = {
  id: "youtube",
  version: YOUTUBE_CONNECTOR_VERSION,
  async discover(query) {
    return fetchYouTubeVideos(await searchIds(query), query.hints ?? {}, query.language);
  },
};
