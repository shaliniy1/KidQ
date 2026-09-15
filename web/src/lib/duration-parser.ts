// The real API only accepts these session lengths (api/src/http/schemas.ts
// sessionStartBody.minutes).
const DURATION_OPTIONS = [15, 30, 45, 60, 90] as const;

/**
 * A small client-side number/unit parser for P7a's mic input ("thirty
 * minutes" -> 30) — spec Table B #7: a single low-ambiguity value doesn't
 * need the full curation NLU API, this is deliberately simpler/cheaper.
 * Returns the nearest valid preset, or null if nothing recognizable.
 */
const WORD_NUMBERS: Record<string, number> = {
  ten: 10,
  fifteen: 15,
  twenty: 20,
  thirty: 30,
  forty: 40,
  "forty-five": 45,
  forty5: 45,
  sixty: 60,
  ninety: 90,
  one: 1,
  hour: 60,
  "an hour": 60,
  "half hour": 30,
  "half an hour": 30,
};

export function parseDurationPhrase(phrase: string): number | null {
  const lower = phrase.toLowerCase().trim();

  if (lower.includes("half an hour") || lower.includes("half hour")) return 30;
  if (lower.includes("an hour") || lower === "hour" || lower.includes("one hour")) return 60;

  // Digit form: "30", "30 min", "30 minutes"
  const digitMatch = lower.match(/(\d+)/);
  if (digitMatch) {
    const n = Number(digitMatch[1]);
    return nearestPreset(n);
  }

  // Word form: "thirty minutes", "forty five minutes"
  for (const [word, value] of Object.entries(WORD_NUMBERS)) {
    if (lower.includes(word)) return nearestPreset(value);
  }

  return null;
}

function nearestPreset(minutes: number): number {
  return DURATION_OPTIONS.reduce((closest, option) =>
    Math.abs(option - minutes) < Math.abs(closest - minutes) ? option : closest
  );
}
