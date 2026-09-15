// Pull-time pre-screen (docs/content-curation/README.md "Pre-screen"): unambiguous signs that a
// discovered item isn't for children aged 0–6, checked before it's stored or sent to the AI.
// Links an admin or a parent adds skip it: the AI and the admin judge those.
// Pure: no I/O.

export const DISCOVERY_MIN_SECONDS = 15;
export const DISCOVERY_MAX_SECONDS = 15 * 60;

export interface PrescreenInput {
  contentType: string;
  title: string;
  description: string | null;
  tags: string[];
  durationSeconds: number | null;
}

export type PrescreenResult = { ok: true } | { ok: false; code: string; reason: string };

interface ScreenRule {
  code: string;
  reason: string;
  pattern: RegExp;
  /** Words that are harmless in a description (a "promo code" link) but telling in a title. */
  titleOnly?: boolean;
}

const RULES: ScreenRule[] = [
  {
    code: "REJECTED_UNSUITABLE",
    reason: "a film trailer",
    pattern: /(?<!\b(?:tractor|truck|horse|boat|camper|car)[ -])\btrailers?\b(?![ -](?:truck|hitch|park))/i,
    titleOnly: true,
  },
  { code: "REJECTED_UNSUITABLE", reason: "horror", pattern: /\bhorror\b/i },
  {
    code: "REJECTED_UNSUITABLE",
    reason: "animal cruelty or an exposé",
    pattern: /\bexpos[éè]s?\b|\banimal liberation\b|\bfactory farm(?:s|ing)?\b|\bslaughter(?:house|houses|ed|ing)?\b|\babattoirs?\b/i,
  },
  {
    code: "REJECTED_NEWS",
    reason: "news, a briefing or a promo",
    pattern:
      /\bthis week @ ?nasa\b|\b(?:press|news) (?:conference|briefing)s?\b|\bbriefings?\b|\bvideo file\b|\bb-?roll\b|\blive ?stream(?:s|ing|ed)?\b|\blive (?:coverage|broadcast|show)\b|\bnasa science live\b|\bpromos?\b|\bannounces\b/i,
    titleOnly: true,
  },
  { code: "REJECTED_OFF_TOPIC", reason: "swimming (butterfly stroke)", pattern: /\bbutterfly (?:stroke|swim(?:s|ming)?)\b/i },
];

export function prescreen(input: PrescreenInput): PrescreenResult {
  // File-style titles join words with underscores ("animation_b-roll_9"); read them as spaces.
  const title = input.title.replace(/_/g, " ");
  const text = [title, input.description ?? "", input.tags.join(" ")].join(" \n ").replace(/_/g, " ");
  for (const rule of RULES) {
    if (rule.pattern.test(rule.titleOnly ? title : text)) return { ok: false, code: rule.code, reason: `Pre-screen: ${rule.reason}.` };
  }
  if (input.contentType === "VIDEO" && input.durationSeconds !== null) {
    if (input.durationSeconds < DISCOVERY_MIN_SECONDS) {
      return { ok: false, code: "REJECTED_TOO_SHORT", reason: `Pre-screen: shorter than ${DISCOVERY_MIN_SECONDS} seconds.` };
    }
    if (input.durationSeconds > DISCOVERY_MAX_SECONDS) {
      return { ok: false, code: "REJECTED_TOO_LONG", reason: `Pre-screen: longer than ${DISCOVERY_MAX_SECONDS / 60} minutes.` };
    }
  }
  return { ok: true };
}
