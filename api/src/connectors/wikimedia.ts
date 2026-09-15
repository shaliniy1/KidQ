// Wikimedia Commons connector — MediaWiki Action API with TimedMediaHandler video info
// (README "Wikimedia Commons"). Stores creator, license, attribution and file page per item;
// files with no recognisable open license are dropped before storage.
import { fetchJson } from "./http";
import { MAX_VIDEO_SECONDS, type Connector, type ConnectorBatch, type NormalizedRecord, type RightsEvidence } from "./types";

const API_URL = "https://commons.wikimedia.org/w/api.php";
export const WIKIMEDIA_CONNECTOR_VERSION = "1";

type ExtMetadata = Record<string, { value?: string } | undefined>;

interface MediaInfo {
  url: string;
  descriptionurl: string;
  mime: string;
  duration?: number;
  thumburl?: string;
  extmetadata?: ExtMetadata;
  derivatives?: Array<{ src: string; type: string; height?: number }>;
}

interface Page {
  pageid: number;
  title: string;
  videoinfo?: MediaInfo[];
  imageinfo?: MediaInfo[];
}

export function stripHtml(value: string | undefined): string {
  return (value ?? "").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
}

export function wikimediaRights(metadata: ExtMetadata, descriptionUrl: string): RightsEvidence | null {
  const license = stripHtml(metadata.LicenseShortName?.value) || null;
  const lower = (license ?? "").toLowerCase();
  const publicDomain = /public domain|\bpd\b|cc0/.test(lower);
  const creativeCommons = /^cc[ -]|creative commons/.test(lower);
  // Unknown permission means the operation is disabled; without a license we don't store the item.
  if (!publicDomain && !creativeCommons) return null;
  const noDerivatives = /\bnd\b|no ?deriv/.test(lower);
  const nonCommercial = /\bnc\b|non-?commercial/.test(lower);
  const artist = stripHtml(metadata.Artist?.value);
  const attributionFlag = metadata.AttributionRequired?.value;
  return {
    licenseName: license,
    licenseUrl: stripHtml(metadata.LicenseUrl?.value) || null,
    attributionText: [artist, license].filter(Boolean).join(" — ") + " (Wikimedia Commons)",
    attributionRequired: attributionFlag ? attributionFlag === "true" : !publicDomain,
    allowsEmbedding: true,
    allowsMetadataStorage: true,
    allowsThumbnailStorage: true,
    allowsTranscriptStorage: !noDerivatives,
    allowsMediaStorage: true,
    allowsAdaptation: !noDerivatives,
    allowsCommercialUse: !nonCommercial,
    evidenceUrl: descriptionUrl,
    evidenceText: `Commons file page license: ${license}; artist: ${artist || "not stated"}.`,
  };
}

/** Prefer MP4 (plays everywhere, incl. TVs and iOS), then ≤480p WebM, then the original. */
export function pickPlayable(info: MediaInfo): { url: string; mime: string } {
  const derivatives = info.derivatives ?? [];
  const mp4 = derivatives.find((d) => d.type.startsWith("video/mp4"));
  const webm = derivatives.filter((d) => d.type.startsWith("video/webm") && (d.height ?? 0) <= 480).sort((a, b) => (b.height ?? 0) - (a.height ?? 0))[0];
  const chosen = mp4 ?? webm;
  if (chosen) return { url: chosen.src, mime: chosen.type.split(";")[0].trim() };
  return { url: info.url, mime: info.mime };
}

function toRecord(page: Page, info: MediaInfo, rights: RightsEvidence, hints: NormalizedRecord["hints"]): NormalizedRecord {
  const metadata = info.extmetadata ?? {};
  const playable = pickPlayable(info);
  const artist = stripHtml(metadata.Artist?.value);
  return {
    sourceSystemId: "wikimedia_commons",
    externalId: String(page.pageid),
    sourceUrl: info.descriptionurl,
    embedUrl: null,
    mediaUrl: playable.url,
    mediaMimeType: playable.mime,
    title: page.title.replace(/^File:/, "").replace(/\.[a-z0-9]+$/i, "").replace(/_/g, " "),
    description: stripHtml(metadata.ImageDescription?.value).slice(0, 2000) || null,
    creator: artist || null,
    thumbnails: info.thumburl ? { medium: info.thumburl } : {},
    thumbnailUrl: info.thumburl ?? null,
    durationSeconds: info.duration ? Math.round(info.duration) : null,
    language: null,
    captionAvailable: false,
    madeForKids: null,
    embeddable: true,
    tags: stripHtml(metadata.Categories?.value).split("|").map((tag) => tag.trim()).filter(Boolean),
    contentType: "VIDEO",
    rights,
    rawMetadata: page,
    hints,
  };
}

export const wikimediaConnector: Connector = {
  id: "wikimedia_commons",
  version: WIKIMEDIA_CONNECTOR_VERSION,
  async discover(query) {
    const batch: ConnectorBatch = { records: [], rejected: 0, seen: 0, errors: [] };
    const pages: Page[] = [];
    let continuation: Record<string, string> = {};
    while (pages.length < query.maxResults) {
      const params = new URLSearchParams({
        action: "query",
        format: "json",
        formatversion: "2",
        maxlag: "5",
        generator: "search",
        gsrsearch: `${query.query} filetype:video`,
        gsrnamespace: "6",
        gsrlimit: String(Math.min(50, query.maxResults - pages.length)),
        prop: "videoinfo",
        viprop: "url|mime|size|extmetadata|derivatives",
        viurlwidth: "640",
        ...continuation,
      });
      const response = await fetchJson<{ query?: { pages?: Page[] }; continue?: Record<string, string> }>(`${API_URL}?${params}`);
      pages.push(...(response.query?.pages ?? []));
      if (!response.continue || !response.query?.pages?.length) break;
      continuation = response.continue;
    }

    for (const page of pages.slice(0, query.maxResults)) {
      batch.seen += 1;
      const info = page.videoinfo?.[0] ?? page.imageinfo?.[0];
      if (!info?.url) {
        batch.errors.push({ externalId: String(page.pageid), code: "MALFORMED_ITEM", message: "Commons page without file info.", retryable: false });
        continue;
      }
      const rights = wikimediaRights(info.extmetadata ?? {}, info.descriptionurl);
      const reason = !info.mime.startsWith("video/")
        ? "REJECTED_NOT_VIDEO"
        : !rights
          ? "REJECTED_LICENSE_UNKNOWN"
          : info.duration && info.duration > MAX_VIDEO_SECONDS
            ? "REJECTED_TOO_LONG"
            : null;
      if (reason || !rights) {
        batch.rejected += 1;
        batch.errors.push({ externalId: String(page.pageid), code: reason ?? "REJECTED_LICENSE_UNKNOWN", message: "Dropped before storage by Commons checks.", retryable: false });
        continue;
      }
      batch.records.push(toRecord(page, info, rights, query.hints ?? {}));
    }
    return batch;
  },
};
