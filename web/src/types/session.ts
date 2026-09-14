export type TimeBand = "morning" | "daytime" | "evening" | "bedtime";
export type TimeBandMode = "auto" | "morning" | "daytime" | "bedtime";

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
  isFinalSlot: boolean;
}

export interface AssembledSession {
  childId: string;
  durationMinutes: number;
  breakIntervalMinutes: number;
  breakType: string;
  totalBreaks: number;
  slots: SessionSlot[];
  usedFallback: boolean;
  fallbackCategory: string | null;
  timeBand: TimeBand;
  assembledAt: string;
}
