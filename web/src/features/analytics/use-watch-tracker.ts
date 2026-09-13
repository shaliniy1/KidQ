"use client";

// Wiring for the child player screen: pass the returned handler to <KidQPlayer onPlayback={...}>.
// Events queue per child and are sent every 15 s, at 20 waiting, and when the page is hidden or closed.
import { useCallback, useEffect, useMemo } from "react";
import { postEvents } from "@/services/analytics";
import type { DeviceType, RecommendationSource, TrackableEvent } from "@/types/analytics";
import { EventQueue, WatchTracker, type PlaybackEvent } from "./tracker";

const FLUSH_EVERY_MS = 15_000;
const queues = new Map<string, EventQueue>();

function queueFor(childId: string): EventQueue {
  let queue = queues.get(childId);
  if (!queue) {
    queue = new EventQueue((events, options) => postEvents(childId, events, options));
    queues.set(childId, queue);
  }
  return queue;
}

/** Stamps an event with its id and time and queues it: clicks, sessions and activities. */
export function track(childId: string, event: TrackableEvent): void {
  queueFor(childId).push({ ...event, client_event_id: crypto.randomUUID(), occurred_at: new Date().toISOString() } as Parameters<EventQueue["push"]>[0]);
}

/** The screen size class only; nothing else about the device is collected. TVs set it themselves. */
export function deviceType(): DeviceType {
  const width = Math.min(window.screen.width, window.screen.height);
  return width < 600 ? "PHONE" : width < 1000 ? "TABLET" : "DESKTOP";
}

/** An activity's time runs from start to complete; the API caps it at the time that really passed. */
export function startActivity(childId: string, activityId: string) {
  const playId = crypto.randomUUID();
  const startedAt = Date.now();
  track(childId, { event_name: "activity_started", activity_id: activityId, play_id: playId });
  return {
    complete: () => track(childId, { event_name: "activity_completed", activity_id: activityId, play_id: playId, active_seconds: (Date.now() - startedAt) / 1000 }),
  };
}

export function useWatchTracker(
  childId: string,
  content: { id: string; duration_seconds: number | null },
  options: { sessionId?: string; recommendationSource?: RecommendationSource } = {},
): (event: PlaybackEvent) => void {
  const { sessionId, recommendationSource } = options;
  const queue = useMemo(() => queueFor(childId), [childId]);
  const tracker = useMemo(
    () => new WatchTracker({ contentId: content.id, durationSeconds: content.duration_seconds, sessionId, recommendationSource, emit: (event) => queue.push(event) }),
    [content.id, content.duration_seconds, sessionId, recommendationSource, queue],
  );

  useEffect(() => {
    const onVisibility = () => {
      const visible = document.visibilityState === "visible";
      tracker.setVisible(visible);
      if (!visible) void queue.flush(true);
    };
    const onPageHide = () => {
      tracker.exit();
      void queue.flush(true);
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", onPageHide);
    const timer = setInterval(() => void queue.flush(), FLUSH_EVERY_MS);
    return () => {
      tracker.exit();
      void queue.flush(true);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", onPageHide);
      clearInterval(timer);
    };
  }, [tracker, queue]);

  return useCallback((event: PlaybackEvent) => tracker.onPlayback(event), [tracker]);
}
