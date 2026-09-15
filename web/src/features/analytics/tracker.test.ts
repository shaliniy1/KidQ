import { describe, expect, it } from "vitest";
import type { AnalyticsEvent } from "../../types/analytics";
import { EventQueue, WatchTracker } from "./tracker";

function setup(duration = 100) {
  let clock = 0;
  let ids = 0;
  const events: AnalyticsEvent[] = [];
  const tracker = new WatchTracker({ contentId: "video-1", durationSeconds: duration, emit: (event) => events.push(event), now: () => clock, newId: () => `id-${++ids}` });
  const at = (seconds: number) => (clock = seconds * 1000);
  const names = () => events.map((event) => event.event_name);
  const last = <T extends AnalyticsEvent["event_name"]>(name: T) => events.filter((event) => event.event_name === name).at(-1) as AnalyticsEvent & { event_name: T };
  return { tracker, events, at, names, last };
}

describe("WatchTracker", () => {
  it("counts only time spent playing on a visible page", () => {
    const { tracker, at, last } = setup();
    tracker.onPlayback({ type: "playing", position: 0, duration: 100 });
    at(10);
    tracker.onPlayback({ type: "buffering", position: 10, duration: 100 });
    at(20);
    tracker.onPlayback({ type: "playing", position: 10, duration: 100 });
    at(30);
    tracker.setVisible(false);
    at(40);
    tracker.setVisible(true);
    at(50);
    tracker.onPlayback({ type: "paused", position: 20, duration: 100 });
    expect(last("video_paused").active_seconds).toBe(30);
  });

  it("sends each checkpoint once and completes at 90%", () => {
    const { tracker, at, names, last } = setup();
    tracker.onPlayback({ type: "playing", position: 0, duration: 100 });
    for (const [second, position] of [[30, 30], [31, 31], [60, 60], [91, 91], [95, 95]]) {
      at(second);
      tracker.onPlayback({ type: "time", position, duration: 100 });
    }
    expect(names()).toEqual(["video_started", "video_progress", "video_progress", "video_progress", "video_progress", "video_completed"]);
    expect(last("video_completed")).toMatchObject({ progress_percent: 91, active_seconds: 0 });
  });

  it("sends every playing second exactly once across its events", () => {
    const { tracker, events, at } = setup();
    tracker.onPlayback({ type: "playing", position: 0, duration: 100 });
    for (const second of [30, 60, 91, 95]) {
      at(second);
      tracker.onPlayback({ type: "time", position: second, duration: 100 });
    }
    const sent = events.reduce((sum, event) => sum + ("active_seconds" in event ? event.active_seconds : 0), 0);
    expect(sent).toBe(91);
  });

  it("starts a new play, marked as a replay, when watched again after the end", () => {
    const { tracker, events, at, names } = setup();
    tracker.onPlayback({ type: "playing", position: 0, duration: 100 });
    at(100);
    tracker.onPlayback({ type: "ended", position: 100, duration: 100 });
    tracker.onPlayback({ type: "playing", position: 0, duration: 100 });
    expect(names().slice(-2)).toEqual(["video_replayed", "video_started"]);
    const plays = new Set(events.map((event) => ("play_id" in event ? event.play_id : null)));
    expect(plays.size).toBe(2);
  });

  it("reports how long a pause lasted when playback resumes", () => {
    const { tracker, at, last } = setup();
    tracker.onPlayback({ type: "playing", position: 0, duration: 100 });
    at(5);
    tracker.onPlayback({ type: "paused", position: 5, duration: 100 });
    at(65);
    tracker.onPlayback({ type: "playing", position: 5, duration: 100 });
    expect(last("video_resumed")).toMatchObject({ pause_duration_seconds: 60, position_seconds: 5 });
  });

  it("sends one exit for a video left part-way, and none after it ended", () => {
    const partway = setup();
    partway.tracker.onPlayback({ type: "playing", position: 0, duration: 100 });
    partway.at(12);
    partway.tracker.onPlayback({ type: "time", position: 12, duration: 100 });
    partway.tracker.exit();
    partway.tracker.exit();
    expect(partway.names()).toEqual(["video_started", "video_exited"]);
    expect(partway.last("video_exited")).toMatchObject({ active_seconds: 12, progress_percent: 12 });

    const finished = setup();
    finished.tracker.onPlayback({ type: "playing", position: 0, duration: 100 });
    finished.at(100);
    finished.tracker.onPlayback({ type: "ended", position: 100, duration: 100 });
    finished.tracker.exit();
    expect(finished.names()).not.toContain("video_exited");
  });
});

describe("EventQueue", () => {
  it("keeps events when a send fails and sends them next time", async () => {
    const sent: number[] = [];
    let fail = true;
    const queue = new EventQueue(async (events) => {
      if (fail) throw new Error("offline");
      sent.push(events.length);
    });
    queue.push({ event_name: "session_ended", client_event_id: "e1", occurred_at: "2026-09-13T10:00:00Z", session_id: "s1" });
    await queue.flush();
    expect(queue.size).toBe(1);
    fail = false;
    await queue.flush();
    expect(sent).toEqual([1]);
    expect(queue.size).toBe(0);
  });
});
