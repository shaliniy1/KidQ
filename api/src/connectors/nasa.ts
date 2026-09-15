// NASA Image and Video Library connector — official search + asset APIs (README "NASA").
// Media stays at NASA and streams from its asset URLs. NASA origin does not remove the need
// to check item-level third-party credits, so those items keep media rights unknown.
import { fetchJson, HttpError } from "./http";
import { MAX_VIDEO_SECONDS, type Connector, type ConnectorBatch, type DiscoveryQuery, type NormalizedRecord, type RightsEvidence } from "./types";

const SEARCH_URL = "https://images-api.nasa.gov/search";
export const NASA_CONNECTOR_VERSION = "1";

interface NasaData {
  nasa_id: string;
  title: string;
  description?: string;
  keywords?: string[];
  media_type: string;
  center?: string;
  secondary_creator?: string;
  photographer?: string;
}

interface NasaItem {
  href: string;
  data: NasaData[];
  links?: Array<{ href: string; rel: string }>;
}

const NASA_CREDIT = /\bNASA\b|JPL|Goddard|Johnson|Kennedy|Marshall|Ames|Langley|Glenn|Armstrong|Stennis/i;
const PREFERRED_FILES = ["~mobile.mp4", "~small.mp4", "~medium.mp4", "~preview.mp4", "~orig.mp4"];

const secure = (url: string) => url.replace(/^http:/, "https:").replace(/ /g, "%20");

export function pickNasaVideo(assets: string[]): string | null {
  for (const suffix of PREFERRED_FILES) {
    const match = assets.find((asset) => asset.endsWith(suffix));
    if (match) return secure(match);
  }
  const anyMp4 = assets.find((asset) => asset.toLowerCase().endsWith(".mp4"));
  return anyMp4 ? secure(anyMp4) : null;
}

/** Accepts "0:02:31", "151.2 s", "151.2" or a number. */
export function parseMediaDuration(value: unknown): number | null {
  if (typeof value === "number") return Math.round(value);
  if (typeof value !== "string") return null;
  const clock = value.match(/^(\d+):(\d{1,2}):(\d{1,2}(?:\.\d+)?)/);
  if (clock) return Math.round(Number(clock[1]) * 3600 + Number(clock[2]) * 60 + Number(clock[3]));
  const seconds = value.match(/^(\d+(?:\.\d+)?)\s*s?/);
  return seconds ? Math.round(Number(seconds[1])) : null;
}

async function readDuration(assets: string[]): Promise<number | null> {
  const metadataUrl = assets.find((asset) => asset.endsWith("metadata.json"));
  if (!metadataUrl) return null;
  const metadata = await fetchJson<Record<string, unknown>>(secure(metadataUrl), { retries: 1 });
  const key = Object.keys(metadata).find((k) => /(^|:)Duration$/i.test(k));
  return key ? parseMediaDuration(metadata[key]) : null;
}

export function nasaRights(data: NasaData): RightsEvidence {
  const credits = [data.secondary_creator, data.photographer].filter((credit): credit is string => Boolean(credit));
  const descriptionCredit = data.description?.match(/credits?:\s*([^\n.]+)/i)?.[1]?.trim();
  if (descriptionCredit) credits.push(descriptionCredit);
  const thirdParty = credits.filter((credit) => !NASA_CREDIT.test(credit));
  const clear = thirdParty.length === 0;
  return {
    licenseName: "NASA media usage guidelines",
    licenseUrl: "https://www.nasa.gov/nasa-brand-center/images-and-media/",
    attributionText: `Courtesy of NASA${data.center ? ` (${data.center})` : ""}${thirdParty.length ? `; credit: ${thirdParty.join(", ")}` : ""}`,
    attributionRequired: clear ? false : true,
    allowsEmbedding: true,
    allowsMetadataStorage: true,
    allowsThumbnailStorage: clear ? true : null,
    allowsTranscriptStorage: clear ? true : null,
    allowsMediaStorage: clear ? true : null,
    allowsAdaptation: clear ? true : null,
    allowsCommercialUse: clear ? true : null,
    evidenceUrl: `https://images.nasa.gov/details/${encodeURIComponent(data.nasa_id)}`,
    evidenceText: clear
      ? "NASA-produced media is generally not copyrighted; NASA must not appear to endorse KidQ."
      : `Third-party credit present (${thirdParty.join(", ")}); item-level rights need admin review.`,
  };
}

function toRecord(item: NasaItem, data: NasaData, mediaUrl: string, durationSeconds: number | null, assets: string[], query: DiscoveryQuery): NormalizedRecord {
  const preview = item.links?.find((link) => link.rel === "preview")?.href;
  return {
    sourceSystemId: "nasa_images",
    externalId: data.nasa_id,
    sourceUrl: `https://images.nasa.gov/details/${encodeURIComponent(data.nasa_id)}`,
    embedUrl: null,
    mediaUrl,
    mediaMimeType: "video/mp4",
    title: data.title,
    description: data.description ?? null,
    creator: data.center ? `NASA ${data.center}` : "NASA",
    thumbnails: preview ? { preview: secure(preview) } : {},
    thumbnailUrl: preview ? secure(preview) : null,
    durationSeconds,
    language: query.language ?? "en",
    captionAvailable: assets.some((asset) => /\.(srt|vtt)$/i.test(asset)),
    madeForKids: null,
    embeddable: true,
    tags: data.keywords ?? [],
    contentType: "VIDEO",
    rights: nasaRights(data),
    rawMetadata: item,
    hints: query.hints ?? {},
  };
}

export const nasaConnector: Connector = {
  id: "nasa_images",
  version: NASA_CONNECTOR_VERSION,
  async discover(query) {
    const batch: ConnectorBatch = { records: [], rejected: 0, seen: 0, errors: [] };
    const items: NasaItem[] = [];
    for (let page = 1; items.length < query.maxResults && page <= 5; page += 1) {
      const params = new URLSearchParams({ q: query.query, media_type: "video", page: String(page), page_size: "50" });
      const response = await fetchJson<{ collection: { items: NasaItem[]; links?: Array<{ rel: string }> } }>(`${SEARCH_URL}?${params}`);
      items.push(...response.collection.items);
      if (!response.collection.links?.some((link) => link.rel === "next") || response.collection.items.length === 0) break;
    }

    for (const item of items.slice(0, query.maxResults)) {
      batch.seen += 1;
      const data = item.data?.[0];
      if (!data?.nasa_id || data.media_type !== "video") {
        batch.errors.push({ externalId: data?.nasa_id ?? null, code: "MALFORMED_ITEM", message: "NASA search item without a video nasa_id.", retryable: false });
        continue;
      }
      try {
        const assets = await fetchJson<string[]>(secure(item.href));
        const mediaUrl = pickNasaVideo(assets);
        const durationSeconds = await readDuration(assets).catch(() => null);
        const reason = !mediaUrl ? "REJECTED_NO_PLAYABLE_FILE" : durationSeconds !== null && durationSeconds > MAX_VIDEO_SECONDS ? "REJECTED_TOO_LONG" : null;
        if (reason || !mediaUrl) {
          batch.rejected += 1;
          batch.errors.push({ externalId: data.nasa_id, code: reason ?? "REJECTED_NO_PLAYABLE_FILE", message: "Dropped before storage by NASA asset checks.", retryable: false });
          continue;
        }
        batch.records.push(toRecord(item, data, mediaUrl, durationSeconds, assets, query));
      } catch (error) {
        batch.errors.push({
          externalId: data.nasa_id,
          code: "ASSET_FETCH_FAILED",
          message: error instanceof Error ? error.message : String(error),
          retryable: error instanceof HttpError ? error.retryable : false,
        });
      }
    }
    return batch;
  },
};
