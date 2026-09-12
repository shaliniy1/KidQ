// KidQ recommendation engine (scoring MD §11): filter admin-approved content by the child
// profile, then rank by relevance, KidQ score, expert review and parent preference.
// Pure: no I/O. Popularity (views, likes, subscribers, trending) is never an input.

export interface ChildProfileInput {
  ageYears: number;
  languages: string[];
  contentTypes: string[];
  interests: string[];
  developmentGoals: string[];
  regulationGoals: string[];
  preferredCategories: string[];
  dailyMinutes: number | null;
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
  category: string | null;
  interests: string[];
  developmentGoals: string[];
  regulationGoals: string[];
  durationSeconds: number | null;
  creator: string | null;
  kidqScore: number | null;
  expert: { recommend: number; total: number } | null;
}

export interface RankingConfig {
  version: string;
  weights: { relevance: number; score: number; expert: number; preference: number };
  params: {
    relevanceWeights: { interests: number; developmentGoals: number; regulationGoals: number; category: number };
    maxPerCreatorInTop: number;
    topWindow: number;
    dismissCooldownDays: number;
    expertNeutral: number;
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

export function childAgeYears(birthYear: number, birthMonth: number, now = new Date()): number {
  const months = (now.getUTCFullYear() - birthYear) * 12 + (now.getUTCMonth() + 1 - birthMonth);
  return Math.max(0, Math.floor((months / 12) * 10) / 10);
}

/** Admin approval, safety, a score and complete tags are all required before anything is recommended. */
export function isEligible(candidate: CandidateInput): boolean {
  return (
    candidate.approved &&
    candidate.playable &&
    !candidate.blocked &&
    candidate.kidqScore !== null &&
    candidate.ageMin !== null &&
    candidate.ageMax !== null &&
    Boolean(candidate.category) &&
    (candidate.developmentGoals.length > 0 || candidate.regulationGoals.length > 0)
  );
}

const baseLanguage = (code: string) => code.toLowerCase().split(/[-_]/)[0];

function passesHardFilters(candidate: CandidateInput, profile: ChildProfileInput): boolean {
  if (candidate.ageMin === null || candidate.ageMax === null) return false;
  if (profile.ageYears < candidate.ageMin || profile.ageYears > candidate.ageMax) return false;
  if (candidate.language && profile.languages.length > 0) {
    if (!profile.languages.map(baseLanguage).includes(baseLanguage(candidate.language))) return false;
  }
  if (profile.contentTypes.length > 0 && !profile.contentTypes.includes(candidate.contentType)) return false;
  return true;
}

function durationFit(durationSeconds: number | null, dailyMinutes: number | null): number {
  if (!durationSeconds || !dailyMinutes) return 0.5;
  const budget = dailyMinutes * 60;
  return durationSeconds <= budget ? 1 : Math.max(0, 1 - (durationSeconds - budget) / budget);
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
    if (candidate.category && profile.preferredCategories.includes(candidate.category)) {
      matched.category = true;
      relevanceSum += weights.category;
    }
  }

  const relevance = weightSum > 0 ? relevanceSum / weightSum : 0;
  const anyMatch =
    matched.interests.length + matched.developmentGoals.length + matched.regulationGoals.length > 0 || matched.category;
  const expert =
    candidate.expert && candidate.expert.total > 0
      ? candidate.expert.recommend / candidate.expert.total
      : config.params.expertNeutral;
  const w = config.weights;
  const finalScore =
    w.relevance * relevance +
    w.score * ((candidate.kidqScore ?? 0) / 100) +
    w.expert * expert +
    w.preference * durationFit(candidate.durationSeconds, profile.dailyMinutes);
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

/** Greedy creator cap inside the top window; capped items keep their order after it. */
function diversify<T extends { creator: string | null; id: string }>(items: T[], maxPerCreator: number, window: number): T[] {
  const head: T[] = [];
  const placed = new Set<number>();
  const counts = new Map<string, number>();
  items.forEach((item, index) => {
    if (head.length >= window) return;
    const creator = item.creator ?? `__unknown:${item.id}`;
    const count = counts.get(creator) ?? 0;
    if (count >= maxPerCreator) return;
    counts.set(creator, count + 1);
    head.push(item);
    placed.add(index);
  });
  return [...head, ...items.filter((_, index) => !placed.has(index))];
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
  const ordered = diversify(
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
