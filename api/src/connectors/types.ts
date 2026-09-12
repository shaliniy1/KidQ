// Connector contract (docs/content-curation/README.md "Universal connector rules").
// Every connector turns an official API response into NormalizedRecords; the shared
// ingestion service handles runs, idempotent upserts, retries and error recording.

export type SourceSystemId = "youtube" | "nasa_images" | "wikimedia_commons";

/** Longer videos are dropped before storage: open-ended compilations don't fit KidQ sessions. */
export const MAX_VIDEO_SECONDS = 60 * 60;

export interface RightsEvidence {
  licenseName: string | null;
  licenseUrl: string | null;
  attributionText: string | null;
  attributionRequired: boolean | null;
  allowsEmbedding: boolean | null;
  allowsMetadataStorage: boolean | null;
  allowsThumbnailStorage: boolean | null;
  allowsTranscriptStorage: boolean | null;
  /** Also gates sending the file to the AI scorer (a temporary copy). Unknown means no. */
  allowsMediaStorage: boolean | null;
  allowsAdaptation: boolean | null;
  allowsCommercialUse: boolean | null;
  evidenceUrl: string | null;
  evidenceText: string;
}

/** Topic, category and age hints from the discovery plan; suggestions only, never approval. */
export interface DiscoveryHints {
  interests?: string[];
  category?: string;
  developmentGoals?: string[];
  regulationGoals?: string[];
  ageMin?: number;
  ageMax?: number;
}

export interface NormalizedRecord {
  sourceSystemId: SourceSystemId;
  externalId: string;
  sourceUrl: string;
  embedUrl: string | null;
  mediaUrl: string | null;
  mediaMimeType: string | null;
  title: string;
  description: string | null;
  creator: string | null;
  thumbnails: Record<string, string>;
  thumbnailUrl: string | null;
  durationSeconds: number | null;
  language: string | null;
  captionAvailable: boolean;
  madeForKids: boolean | null;
  embeddable: boolean | null;
  tags: string[];
  contentType: "VIDEO";
  rights: RightsEvidence;
  /** The original API response for this item, kept for audit and reprocessing. */
  rawMetadata: unknown;
  hints: DiscoveryHints;
}

export interface DiscoveryQuery {
  query: string;
  maxResults: number;
  language?: string;
  regionCode?: string;
  channelId?: string;
  hints?: DiscoveryHints;
}

export interface ItemError {
  externalId: string | null;
  code: string;
  message: string;
  retryable: boolean;
}

export interface ConnectorBatch {
  records: NormalizedRecord[];
  /** Items seen but dropped before storage (private, unavailable, not embeddable, too long). */
  rejected: number;
  seen: number;
  errors: ItemError[];
}

export interface Connector {
  id: SourceSystemId;
  version: string;
  discover(query: DiscoveryQuery): Promise<ConnectorBatch>;
}
