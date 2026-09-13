// StoryWeaver connector (docs/content-curation/storyweaver.md). Uses StoryWeaver's public web API —
// books-search for discovery, then each story's reader pages. That API isn't formally documented,
// so confirm the integration with StoryWeaver before prod. A story is stored only when its
// attribution page releases the story and every illustration under CC BY, CC BY-SA or CC0; the
// illustrations themselves stay on StoryWeaver's servers.
import { env } from "../config/env";
import { fetchJson, HttpError } from "./http";
import type { Connector, ConnectorBatch, DiscoveryQuery, NormalizedRecord, RightsEvidence, StoryContent, StoryPage } from "./types";

const API_URL = "https://storyweaver.org.in/api/v1";
/** StoryWeaver answers 429 after ~30 quick book fetches, so KidQ reads about one book every 2 seconds. */
const PAUSE_MS = env.nodeEnv === "test" ? 0 : 2_000;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const STORY_URL = "https://storyweaver.org.in/en/stories";
export const STORYWEAVER_CONNECTOR_VERSION = "1";

/** Levels 1–2 ("easy words, word repetition" and "simple words") suit reading aloud to 2–6-year-olds. */
const LEVELS = ["1", "2"];
const MAX_PAGES = 30;
const LANGUAGES: Record<string, string> = { en: "English", hi: "Hindi", es: "Spanish" };
const OPEN_LICENSE = /^(CC BY(-SA)?( \d\.\d)?|CC0( \d\.\d)?|PUBLIC DOMAIN)$/;

interface ImageSizes {
  sizes?: Array<{ url: string; width: number; height: number }>;
}

interface Person {
  name: string;
}

export interface SearchHit {
  id: number;
  title: string;
  language: string;
  level: string;
  slug: string;
  description?: string | null;
  coverImage?: ImageSizes;
  authors?: Person[];
  illustrators?: Person[];
  publisher?: { name: string } | null;
}

export interface ReaderPage {
  /** StoryWeaver's own spelling. */
  pagePostion: number;
  pageType: string;
  html?: string;
  coverImage?: ImageSizes;
}

function decodeEntities(value: string): string {
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&nbsp;/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&(?:apos|rsquo|lsquo);/g, "'")
    .replace(/&(?:ldquo|rdquo);/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

/** A reader page's visible text: scripts and markup removed, and the trailing "3/10" page counter dropped. */
export function pageText(html: string): string {
  const text = decodeEntities(html.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<[^>]+>/g, " "))
    .replace(/­/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return text.replace(/\s*\b\d+\s*\/\s*\d+$/, "").trim();
}

/** The smallest rendition at least `width` pixels wide (or the largest there is). */
function sized(image: ImageSizes | undefined, width: number): string | null {
  const sizes = (image?.sizes ?? []).filter((size) => size.url).sort((a, b) => a.width - b.width);
  if (sizes.length === 0) return null;
  return (sizes.find((size) => size.width >= width) ?? sizes[sizes.length - 1]).url;
}

/** Every license named on the attribution page, e.g. "Released under CC BY 4.0 license" → "CC BY 4.0". */
export function licensesIn(credits: string): string[] {
  const found = [...credits.matchAll(/Released under (?:the )?(.+?) licen[cs]e/gi)].map((match) => match[1].trim().toUpperCase().replace(/\s+/g, " "));
  return [...new Set(found)];
}

export function parseStory(pages: ReaderPage[]): { story: StoryContent; licenses: string[] } {
  const storyPages: StoryPage[] = [...pages]
    .sort((a, b) => a.pagePostion - b.pagePostion)
    .filter((page) => page.pageType === "StoryPage")
    .map((page, index) => ({
      page: index + 1,
      text: pageText(page.html ?? ""),
      image_url: sized(page.coverImage, 700),
      image_small_url: sized(page.coverImage, 400),
    }));
  const creditsHtml = pages.find((page) => page.pageType === "BackInnerCoverPage")?.html;
  const credits = creditsHtml ? pageText(creditsHtml) : null;
  return { story: { pages: storyPages, credits }, licenses: credits ? licensesIn(credits) : [] };
}

const names = (people?: Person[]) =>
  (people ?? [])
    .map((person) => person.name)
    .filter(Boolean)
    .join(", ");

function licenseUrl(license: string): string | null {
  const cc = /^CC (BY(?:-SA)?) (\d\.\d)$/.exec(license);
  if (cc) return `https://creativecommons.org/licenses/${cc[1].toLowerCase()}/${cc[2]}/`;
  return license.startsWith("CC0") ? "https://creativecommons.org/publicdomain/zero/1.0/" : null;
}

/** Rights for one story, or null when a license on its attribution page isn't open (or none is stated). */
export function storyweaverRights(hit: SearchHit, credits: string, licenses: string[]): RightsEvidence | null {
  if (licenses.length === 0 || !licenses.every((license) => OPEN_LICENSE.test(license))) return null;
  const license = licenses.join(", ");
  const author = names(hit.authors);
  const illustrator = names(hit.illustrators);
  return {
    licenseName: license,
    licenseUrl: licenseUrl(licenses[0]),
    attributionText: [
      `Source: StoryWeaver${hit.publisher?.name ? ` by ${hit.publisher.name}` : ""}`,
      author && `Written by ${author}`,
      illustrator && `Illustrated by ${illustrator}`,
      `Licensed under ${license}`,
    ]
      .filter(Boolean)
      .join(" · "),
    attributionRequired: !licenses.every((item) => item.startsWith("CC0") || item === "PUBLIC DOMAIN"),
    allowsEmbedding: true,
    allowsMetadataStorage: true,
    allowsThumbnailStorage: true,
    // Open licenses allow copying the text with credit; the KidQ reader shows it.
    allowsTranscriptStorage: true,
    // Also lets the AI reviewer receive the illustrations (a temporary copy).
    allowsMediaStorage: true,
    allowsAdaptation: true,
    allowsCommercialUse: true,
    evidenceUrl: `${STORY_URL}/${hit.slug}`,
    evidenceText: `StoryWeaver attribution page: ${credits.slice(0, 600)}`,
  };
}

/** Read-aloud time: about 100 words a minute plus a few seconds per page turn. */
export function readingSeconds(pages: StoryPage[]): number {
  const words = pages.reduce((sum, page) => sum + (page.text.match(/\S+/g)?.length ?? 0), 0);
  return Math.max(60, Math.round((words / 100) * 60 + pages.length * 5));
}

function toRecord(hit: SearchHit, reader: unknown, story: StoryContent, rights: RightsEvidence, query: DiscoveryQuery): NormalizedRecord {
  const cover = hit.coverImage;
  const thumbnails = Object.fromEntries(
    Object.entries({ small: sized(cover, 300), medium: sized(cover, 540), large: sized(cover, 800) }).filter((entry): entry is [string, string] => Boolean(entry[1])),
  );
  return {
    sourceSystemId: "storyweaver",
    externalId: String(hit.id),
    sourceUrl: `${STORY_URL}/${hit.slug}`,
    embedUrl: null,
    mediaUrl: null,
    mediaMimeType: null,
    title: hit.title,
    description: hit.description ?? null,
    creator: names(hit.authors) || null,
    thumbnails,
    thumbnailUrl: thumbnails.medium ?? null,
    durationSeconds: readingSeconds(story.pages),
    language: Object.entries(LANGUAGES).find(([, name]) => name === hit.language)?.[0] ?? null,
    captionAvailable: false,
    madeForKids: null,
    embeddable: true,
    tags: [`Level ${hit.level}`, hit.publisher?.name].filter((tag): tag is string => Boolean(tag)),
    contentType: "STORYBOOK",
    rights,
    rawMetadata: { search: hit, reader },
    hints: query.hints ?? {},
    story,
  };
}

export const storyweaverConnector: Connector = {
  id: "storyweaver",
  version: STORYWEAVER_CONNECTOR_VERSION,
  async discover(query) {
    const batch: ConnectorBatch = { records: [], rejected: 0, seen: 0, errors: [] };
    const hits: SearchHit[] = [];
    for (let page = 1; hits.length < query.maxResults && page <= 5; page += 1) {
      const params = new URLSearchParams({ page: String(page), per_page: String(Math.min(24, query.maxResults)), query: query.query });
      params.append("languages[]", LANGUAGES[query.language ?? "en"] ?? "English");
      for (const level of LEVELS) params.append("levels[]", level);
      const response = await fetchJson<{ data?: SearchHit[]; metadata?: { totalPages?: number } }>(`${API_URL}/books-search?${params}`);
      hits.push(...(response.data ?? []));
      if (!response.data?.length || page >= (response.metadata?.totalPages ?? 1)) break;
    }

    for (const hit of hits.slice(0, query.maxResults)) {
      batch.seen += 1;
      if (!hit?.id || !hit.slug) {
        batch.errors.push({ externalId: hit?.id ? String(hit.id) : null, code: "MALFORMED_ITEM", message: "StoryWeaver search result without an id or slug.", retryable: false });
        continue;
      }
      try {
        if (PAUSE_MS) await sleep(PAUSE_MS);
        const reader = (await fetchJson<{ data?: { pages?: ReaderPage[] } }>(`${API_URL}/stories/${encodeURIComponent(hit.slug)}/read`, { retries: 5 })).data ?? {};
        const { story, licenses } = parseStory(reader.pages ?? []);
        const rights = story.credits ? storyweaverRights(hit, story.credits, licenses) : null;
        const reason =
          story.pages.length === 0 ? "REJECTED_NO_STORY_PAGES" : !rights ? "REJECTED_LICENSE_NOT_OPEN" : story.pages.length > MAX_PAGES ? "REJECTED_TOO_LONG" : null;
        if (reason || !rights) {
          batch.rejected += 1;
          batch.errors.push({
            externalId: String(hit.id),
            code: reason ?? "REJECTED_LICENSE_NOT_OPEN",
            message: `Dropped before storage by StoryWeaver checks (licenses found: ${licenses.join(", ") || "none"}).`,
            retryable: false,
          });
          continue;
        }
        batch.records.push(toRecord(hit, reader, story, rights, query));
      } catch (error) {
        batch.errors.push({
          externalId: String(hit.id),
          code: "STORY_FETCH_FAILED",
          message: error instanceof Error ? error.message : String(error),
          retryable: error instanceof HttpError ? error.retryable : false,
        });
      }
    }
    return batch;
  },
};
