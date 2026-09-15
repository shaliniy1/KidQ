// Parent Analytics tracking (docs/api/README.md "Analytics"). WatchTracker turns the KidQ Player's
// onPlayback callbacks into viewing events for one video. Screen time counts only while the picture
// is playing and the page is visible: paused, buffering, a hidden tab and idle time never count.
// Pure: the clock, ids and delivery are injected, so it's unit-tested without a browser.
import type { AnalyticsEvent, RecommendationSource } from "@/types/analytics";

/** Mirrors PlaybackEvent from @kidq/player. */
export interface PlaybackEvent {
  type: "playing" | "paused" | "buffering" | "ended" | "time";
  position: number;
  duration: number;
}

export const CHECKPOINTS = [25, 50, 75, 90];
export const COMPLETED_AT = 90;

export interface WatchTrackerOptions {
  contentId: string;
  durationSeconds?: number | null;
  sessionId?: string;
  recommendationSource?: RecommendationSource;
  emit(event: AnalyticsEvent): void;
  now?: () => number;
  newId?: () => string;
}

const round = (value: number, places = 2) => Math.round(value * 10 ** places) / 10 ** places;

export class WatchTracker {
  private readonly now: () => number;
  private readonly newId: () => string;
  private playId: string | null = null;
  private plays = 0;
  private playing = false;
  private visible = true;
  private countingSince: number | null = null;
  /** Active seconds not yet sent with an event. */
  private unsent = 0;
  private fired = new Set<number>();
  private completed = false;
  private ended = false;
  private pausedAt: number | null = null;
  private position = 0;
  private duration: number;

  constructor(private readonly options: WatchTrackerOptions) {
    this.now = options.now ?? Date.now;
    this.newId = options.newId ?? (() => crypto.randomUUID());
    this.duration = options.durationSeconds ?? 0;
  }

  onPlayback(event: PlaybackEvent): void {
    if (event.duration > 0) this.duration = event.duration;
    this.position = event.position;
    switch (event.type) {
      case "playing":
        this.begin();
        this.update(() => (this.playing = true));
        break;
      case "time":
        this.checkpoints();
        break;
      case "buffering":
        this.update(() => (this.playing = false));
        break;
      case "paused":
        this.update(() => (this.playing = false));
        if (this.playId && !this.ended && this.pausedAt === null) {
          this.pausedAt = this.now();
          this.emit({ ...this.video(), event_name: "video_paused", ...this.at(), active_seconds: this.takeActive() });
        }
        break;
      case "ended":
        this.update(() => (this.playing = false));
        this.position = Math.max(this.position, this.duration);
        this.checkpoints();
        this.ended = true;
        break;
    }
  }

  setVisible(visible: boolean): void {
    this.update(() => (this.visible = visible));
  }

  /** The child left the video (closed it, moved on, or the page went away) before it ended. */
  exit(): void {
    if (!this.playId || this.ended) return;
    this.update(() => (this.playing = false));
    this.emit({ ...this.video(), event_name: "video_exited", ...this.at(), active_seconds: this.takeActive() });
    this.playId = null;
  }

  private begin(): void {
    if (this.playId && !this.ended) {
      if (this.pausedAt !== null) {
        this.emit({ ...this.video(), event_name: "video_resumed", position_seconds: round(this.position), pause_duration_seconds: round((this.now() - this.pausedAt) / 1000) });
        this.pausedAt = null;
      }
      return;
    }
    // A new play: the first one, or watching again after the end.
    const replay = this.ended;
    this.playId = this.newId();
    this.plays += 1;
    this.fired.clear();
    this.completed = false;
    this.ended = false;
    this.pausedAt = null;
    this.unsent = 0;
    if (replay) this.emit({ ...this.video(), event_name: "video_replayed" });
    this.emit({
      ...this.video(),
      event_name: "video_started",
      ...(this.plays === 1 && this.options.recommendationSource ? { recommendation_source: this.options.recommendationSource } : {}),
    });
  }

  private checkpoints(): void {
    if (!this.playId) return;
    const progress = this.progress();
    for (const checkpoint of CHECKPOINTS) {
      if (progress < checkpoint || this.fired.has(checkpoint)) continue;
      this.fired.add(checkpoint);
      this.emit({ ...this.video(), event_name: "video_progress", ...this.at(), active_seconds: this.takeActive() });
    }
    if (progress >= COMPLETED_AT && !this.completed) {
      this.completed = true;
      this.emit({ ...this.video(), event_name: "video_completed", ...this.at(), active_seconds: this.takeActive() });
    }
  }

  /** Banks the time counted under the current state, applies the change, and restarts the clock if it should run. */
  private update(change: () => void): void {
    this.bank();
    change();
    this.countingSince = this.playing && this.visible ? this.now() : null;
  }

  private bank(): void {
    const now = this.now();
    if (this.countingSince !== null) this.unsent += (now - this.countingSince) / 1000;
    this.countingSince = this.playing && this.visible ? now : null;
  }

  private takeActive(): number {
    this.bank();
    const seconds = round(this.unsent);
    this.unsent = 0;
    return seconds;
  }

  private progress(): number {
    return this.duration > 0 ? Math.min(100, round((this.position / this.duration) * 100, 1)) : 0;
  }

  private at() {
    return { position_seconds: round(Math.max(0, this.position)), progress_percent: this.progress() };
  }

  private video() {
    return {
      client_event_id: this.newId(),
      occurred_at: new Date(this.now()).toISOString(),
      content_id: this.options.contentId,
      play_id: this.playId as string,
      ...(this.options.sessionId ? { session_id: this.options.sessionId } : {}),
    };
  }

  private emit(event: AnalyticsEvent): void {
    this.options.emit(event);
  }
}

/** Holds events until they're sent: every 15 s, at 20 waiting, or when the page goes away. A failed send keeps them. */
export class EventQueue {
  private pending: AnalyticsEvent[] = [];
  private sending = false;

  constructor(
    private readonly send: (events: AnalyticsEvent[], options: { keepalive: boolean }) => Promise<void>,
    private readonly flushAt = 20,
  ) {}

  push(event: AnalyticsEvent): void {
    this.pending.push(event);
    if (this.pending.length >= this.flushAt) void this.flush();
  }

  get size(): number {
    return this.pending.length;
  }

  async flush(keepalive = false): Promise<void> {
    if ((this.sending && !keepalive) || this.pending.length === 0) return;
    const batch = this.pending.splice(0, 50);
    this.sending = true;
    try {
      await this.send(batch, { keepalive });
    } catch {
      // Ids make a resend safe: the API counts each event once.
      this.pending.unshift(...batch);
    } finally {
      this.sending = false;
    }
  }
}
