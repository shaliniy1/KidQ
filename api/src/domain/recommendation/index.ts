// KidQ recommendation engine (RANK_V2, docs/recommendation/README.md "Recommendation engine"):
// filter admin-approved content by the child profile, rank it by relevance, KidQ score, learning
// value and fit, then mix it so no two items of one category sit side by side.
// Pure: no I/O. Popularity (views, likes, subscribers, trending) is never an input.

export interface ChildProfileInput {
  ageYears: number;
  languages: string[];
  interests: string[];
  developmentGoals: string[];
  regulationGoals: string[];
  /** CHOSEN shows only preferredCategories; SURPRISE is an age-appropriate mix. */
  contentMix: "SURPRISE" | "CHOSEN";
  preferredCategories: string[];
  sessionMinutes: number | null;
}

export interface CandidateInput {
  id: string;
  approved: boolean;
  playable: boolean;
  blocked: boolean;
  contentType: string;
  language: string | null;
  ageMin: number | null;
  ageMax: number | null;
  /** The primary category. */
  category: string | null;
  /** Every category the item fits, primary first. */
  categories: string[];
  interests: string[];
  developmentGoals: string[];
  regulationGoals: string[];
  durationSeconds: number | null;
  creator: string | null;
  kidqScore: number | null;
  /** 0–100 from the filter-in criteria; null when not judged. */
  learningValue: number | null;
}

export interface RankingConfig {
  version: string;
  /** `learning` arrived with RANK_V2; older versions rank without it. */
  weights: { relevance: number; score: number; preference: number; learning?: number };
  params: {
    relevanceWeights: { interests: number; developmentGoals: number; regulationGoals: number; category: number };
    maxPerCreatorInTop: number;
    topWindow: number;
    dismissCooldownDays: number;
  };
}

export interface Matched {
  interests: string[];
  developmentGoals: string[];
  regulationGoals: string[];
  category: boolean;
}

export interface RankedRecommendation {
  contentId: string;
  rank: number;
  finalScore: number;
  relevance: number;
  /** No profile overlap: shown only to fill the feed, ordered by KidQ score. */
  coldStart: boolean;
  matched: Matched;
  why: string[];
}

const MAX_AGE = 6;
// An item whose learning value nobody judged ranks as if it were middling, not as if it had none.
const NEUTRAL_LEARNING = 50;

export type EligibilityProblem = "NOT_APPROVED" | "NOT_PLAYABLE" | "SAFETY_FLAG" | "NOT_SCORED" | "NO_AGE" | "NO_CATEGORY" | "NO_GOAL";

/** Why an item can't be recommended; empty when it can. Admin approval, safety, a score and complete tags are all required. */
export function eligibilityProblems(candidate: CandidateInput): EligibilityProblem[] {
  const problems: EligibilityProblem[] = [];
  if (!candidate.approved) problems.push("NOT_APPROVED");
  if (!candidate.playable) problems.push("NOT_PLAYABLE");
  if (candidate.blocked) problems.push("SAFETY_FLAG");
  if (candidate.kidqScore === null) problems.push("NOT_SCORED");
  if (candidate.ageMin === null || candidate.ageMax === null) problems.push("NO_AGE");
  if (!candidate.category) problems.push("NO_CATEGORY");
  if (candidate.developmentGoals.length === 0 && candidate.regulationGoals.length === 0) problems.push("NO_GOAL");
  return problems;
}

export function isEligible(candidate: CandidateInput): boolean {
  return eligibilityProblems(candidate).length === 0;
}

const baseLanguage = (code: string) => code.toLowerCase().split(/[-_]/)[0];
const categoriesOf = (candidate: CandidateInput) => (candidate.categories.length ? candidate.categories : candidate.category ? [candidate.category] : []);

function passesHardFilters(candidate: CandidateInput, profile: ChildProfileInput): boolean {
  if (candidate.ageMin === null || candidate.ageMax === null) return false;
  if (profile.ageYears < candidate.ageMin || profile.ageYears > candidate.ageMax) return false;
  if (candidate.language && profile.languages.length > 0) {
    if (!profile.languages.map(baseLanguage).includes(baseLanguage(candidate.language))) return false;
  }
  // "Let me choose categories": only items that fit one of the parent's chosen categories.
  if (profile.contentMix === "CHOSEN" && !categoriesOf(candidate).some((key) => profile.preferredCategories.includes(key))) return false;
  return true;
}

/** An item that fits inside one session scores 1; longer ones score less. */
function durationFit(durationSeconds: number | null, sessionMinutes: number | null): number {
  if (!durationSeconds || !sessionMinutes) return 0.5;
  const budget = sessionMinutes * 60;
  return durationSeconds <= budget ? 1 : Math.max(0, 1 - (durationSeconds - budget) / budget);
}

/** 1 when the child's age sits in the middle of the item's range, 0.5 at its edges: made-for-this-age beats merely allowed. */
export function ageFit(ageYears: number, ageMin: number, ageMax: number): number {
  const middle = (ageMin + ageMax) / 2;
  const halfRange = Math.max((ageMax - ageMin) / 2, 0.5);
  return 1 - 0.5 * Math.min(1, Math.abs(ageYears - middle) / halfRange);
}

function scoreCandidate(candidate: CandidateInput, profile: ChildProfileInput, config: RankingConfig) {
  const weights = config.params.relevanceWeights;
  const matched: Matched = { interests: [], developmentGoals: [], regulationGoals: [], category: false };
  let weightSum = 0;
  let relevanceSum = 0;

  // Only the dimensions the parent actually filled in count toward relevance.
  const dimensions = [
    ["interests", weights.interests, candidate.interests, profile.interests],
    ["developmentGoals", weights.developmentGoals, candidate.developmentGoals, profile.developmentGoals],
    ["regulationGoals", weights.regulationGoals, candidate.regulationGoals, profile.regulationGoals],
  ] as const;
  for (const [key, weight, content, wanted] of dimensions) {
    if (wanted.length === 0) continue;
    weightSum += weight;
    const overlap = content.filter((value) => wanted.includes(value));
    matched[key] = overlap;
    // Overlap coefficient: content fully inside the parent's choices scores 1.
    if (overlap.length > 0) relevanceSum += weight * (overlap.length / Math.min(content.length, wanted.length));
  }
  if (profile.preferredCategories.length > 0) {
    weightSum += weights.category;
    if (categoriesOf(candidate).some((key) => profile.preferredCategories.includes(key))) {
      matched.category = true;
      relevanceSum += weights.category;
    }
  }

  const relevance = weightSum > 0 ? relevanceSum / weightSum : 0;
  const anyMatch =
    matched.interests.length + matched.developmentGoals.length + matched.regulationGoals.length > 0 || matched.category;
  const fit = (ageFit(profile.ageYears, candidate.ageMin ?? 0, candidate.ageMax ?? MAX_AGE) + durationFit(candidate.durationSeconds, profile.sessionMinutes)) / 2;
  const w = config.weights;
  const finalScore =
    w.relevance * relevance +
    w.score * ((candidate.kidqScore ?? 0) / 100) +
    (w.learning ?? 0) * ((candidate.learningValue ?? NEUTRAL_LEARNING) / 100) +
    w.preference * fit;
  return { relevance, anyMatch, matched, finalScore };
}

function explain(candidate: CandidateInput, matched: Matched, coldStart: boolean, ageYears: number): string[] {
  const why: string[] = [];
  if (coldStart) why.push(`Top KidQ score for age ${Math.floor(ageYears)}`);
  if (matched.interests.length) why.push(`Interests: ${matched.interests.join(", ")}`);
  if (matched.developmentGoals.length) why.push(`Development goals: ${matched.developmentGoals.join(", ")}`);
  if (matched.regulationGoals.length) why.push(`Regulation goals: ${matched.regulationGoals.join(", ")}`);
  if (matched.category && candidate.category) why.push(`Preferred category: ${candidate.category}`);
  why.push(`Age ${candidate.ageMin}–${candidate.ageMax}`);
  return why;
}

/**
 * Variety: walks the ranked list and takes the best item that isn't the same category as the one
 * before it, and whose creator hasn't filled their share of the top window. Nothing is dropped;
 * when no item qualifies, the best remaining one goes next.
 */
function arrange<T extends { id: string; creator: string | null; category: string | null }>(items: T[], maxPerCreator: number, window: number): T[] {
  const remaining = [...items];
  const arranged: T[] = [];
  const perCreator = new Map<string, number>();
  const creatorOf = (item: T) => item.creator ?? `__unknown:${item.id}`;
  const withinCap = (item: T) => arranged.length >= window || (perCreator.get(creatorOf(item)) ?? 0) < maxPerCreator;
  const repeats = (item: T) => arranged.length > 0 && arranged[arranged.length - 1].category === item.category;
  while (remaining.length > 0) {
    let index = remaining.findIndex((item) => withinCap(item) && !repeats(item));
    if (index < 0) index = remaining.findIndex(withinCap);
    if (index < 0) index = 0;
    const [item] = remaining.splice(index, 1);
    arranged.push(item);
    perCreator.set(creatorOf(item), (perCreator.get(creatorOf(item)) ?? 0) + 1);
  }
  return arranged;
}

const round3 = (value: number) => Math.round(value * 1000) / 1000;

export function recommend(
  profile: ChildProfileInput,
  candidates: CandidateInput[],
  config: RankingConfig,
  excludedIds: Set<string>,
  options: { limit?: number; offset?: number } = {},
): RankedRecommendation[] {
  const limit = options.limit ?? 20;
  const offset = options.offset ?? 0;
  const child = { ...profile, ageYears: Math.min(profile.ageYears, MAX_AGE) };

  const scored = candidates
    .filter((candidate) => isEligible(candidate) && !excludedIds.has(candidate.id) && passesHardFilters(candidate, child))
    .map((candidate) => ({ ...candidate, result: scoreCandidate(candidate, child, config) }));

  type Scored = (typeof scored)[number];
  const byScore = (a: Scored, b: Scored) =>
    b.result.finalScore - a.result.finalScore || (b.kidqScore ?? 0) - (a.kidqScore ?? 0) || a.id.localeCompare(b.id);
  const ordered = arrange(
    [...scored.filter((s) => s.result.anyMatch).sort(byScore), ...scored.filter((s) => !s.result.anyMatch).sort(byScore)],
    config.params.maxPerCreatorInTop,
    config.params.topWindow,
  );

  return ordered.slice(offset, offset + limit).map((item, index) => ({
    contentId: item.id,
    rank: offset + index + 1,
    finalScore: round3(item.result.finalScore),
    relevance: round3(item.result.relevance),
    coldStart: !item.result.anyMatch,
    matched: item.result.matched,
    why: explain(item, item.result.matched, !item.result.anyMatch, child.ageYears),
  }));
}
