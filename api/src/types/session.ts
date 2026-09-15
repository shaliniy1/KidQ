import type { BreakType } from "./curation-settings";
import type { TimeBand } from "../services/time-band";

export interface SessionSlotVideo {
  contentId: string;
  title: string;
  category: string | null;
  durationSeconds: number;
  embedUrl: string | null;
  thumbnailUrl: string | null;
}

export interface SessionSlot {
  index: number;
  videos: SessionSlotVideo[];
  /** The mandatory wind-down break — always the last slot, regardless of interval. */
  isFinalSlot: boolean;
}

export interface AssembledSession {
  /** Unique per assembly — the join key device-sync tracking (ticket 15) uses to know which queue it's acknowledging. */
  sessionId: string;
  childId: string;
  durationMinutes: number;
  breakIntervalMinutes: number;
  breakType: BreakType;
  totalBreaks: number;
  slots: SessionSlot[];
  /** Whether any slot had to pull from the adjacent age band (spec Section 2 Rule 6). */
  usedFallback: boolean;
  fallbackCategory: string | null;
  timeBand: TimeBand;
  assembledAt: string;
}
