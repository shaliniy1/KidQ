import type { DailySchedule } from "../types/curation-settings";

/**
 * Phase-1 behavior is reminder-only: never gates a session, just flags
 * whether now (the server's own clock — same "never trust the device"
 * principle as time-band.ts) falls outside the saved window, so the
 * frontend can show a soft, non-blocking terracotta note (spec Section
 * 11 #27).
 */
export function isOutsideSchedule(schedule: DailySchedule, now: Date = new Date()): boolean {
  if (!schedule.enabled) return false;

  const [startHour, startMinute] = schedule.startTime.split(":").map(Number);
  const [endHour, endMinute] = schedule.endTime.split(":").map(Number);
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const startMinutes = startHour * 60 + startMinute;
  const endMinutes = endHour * 60 + endMinute;

  if (startMinutes <= endMinutes) {
    return nowMinutes < startMinutes || nowMinutes > endMinutes;
  }
  // Overnight window (e.g. 19:00-07:00) wraps past midnight.
  return nowMinutes > endMinutes && nowMinutes < startMinutes;
}
