import { describe, expect, it } from "vitest";
import {
  childAgeYears,
  recommend,
  type CandidateInput,
  type ChildProfileInput,
  type RankingConfig,
} from "../../src/domain/recommendation";

const config: RankingConfig = {
  version: "RANK_V1",
  weights: { relevance: 0.45, score: 0.35, expert: 0.1, preference: 0.1 },
  params: {
    relevanceWeights: { interests: 0.4, developmentGoals: 0.3, regulationGoals: 0.2, category: 0.1 },
    maxPerCreatorInTop: 3,
    topWindow: 20,
    dismissCooldownDays: 14,
    expertNeutral: 0.5,
  },
};

const profile: ChildProfileInput = {
  ageYears: 4,
  languages: ["en"],
  contentTypes: ["VIDEO"],
  interests: ["animals", "space"],
  developmentGoals: ["social"],
  regulationGoals: ["calm"],
  preferredCategories: [],
  dailyMinutes: 30,
};

let counter = 0;
function candidate(overrides: Partial<CandidateInput> = {}): CandidateInput {
  counter += 1;
  return {
    id: `c${String(counter).padStart(3, "0")}`,
    approved: true,
    playable: true,
    blocked: false,
    contentType: "VIDEO",
    language: "en",
    ageMin: 2,
    ageMax: 6,
    category: "animals_nature",
    interests: ["animals"],
    developmentGoals: ["social"],
    regulationGoals: [],
    durationSeconds: 300,
    creator: `creator-${counter}`,
    kidqScore: 80,
    expert: null,
    ...overrides,
  };
}

describe("recommend", () => {
  it("only returns approved, playable, unflagged, fully tagged content that fits the child", () => {
    const good = candidate();
    const rejected = [
      candidate({ approved: false }),
      candidate({ playable: false }),
      candidate({ blocked: true }),
      candidate({ kidqScore: null }),
      candidate({ category: null }),
      candidate({ developmentGoals: [], regulationGoals: [] }),
      candidate({ ageMin: 5, ageMax: 6 }),
      candidate({ language: "hi" }),
      candidate({ contentType: "STORYBOOK" }),
    ];
    const result = recommend(profile, [good, ...rejected], config, new Set());
    expect(result.map((r) => r.contentId)).toEqual([good.id]);
  });

  it("ranks profile matches above higher-scored unmatched content, which is labelled cold start", () => {
    const match = candidate({ kidqScore: 70 });
    const unmatched = candidate({ kidqScore: 99, interests: ["music"], developmentGoals: ["motor_skills"] });
    const [first, second] = recommend(profile, [unmatched, match], config, new Set());
    expect(first.contentId).toBe(match.id);
    expect(first.coldStart).toBe(false);
    expect(first.why).toContain("Interests: animals");
    expect(second.contentId).toBe(unmatched.id);
    expect(second.coldStart).toBe(true);
    expect(second.why[0]).toBe("Top KidQ score for age 4");
  });

  it("caps any one creator at 3 inside the top window", () => {
    const sameCreator = Array.from({ length: 5 }, () => candidate({ creator: "One Channel", kidqScore: 95 }));
    const others = Array.from({ length: 3 }, () => candidate({ kidqScore: 60 }));
    const ids = recommend(profile, [...sameCreator, ...others], config, new Set()).map((r) => r.contentId);
    const sameIds = new Set(sameCreator.map((c) => c.id));
    expect(ids.slice(0, 6).filter((id) => sameIds.has(id))).toHaveLength(3);
    expect(ids).toHaveLength(8);
  });

  it("skips items already in the library or recently dismissed", () => {
    const kept = candidate();
    const inLibrary = candidate();
    const result = recommend(profile, [kept, inLibrary], config, new Set([inLibrary.id]));
    expect(result.map((r) => r.contentId)).toEqual([kept.id]);
  });

  it("ignores popularity signals entirely", () => {
    const better = candidate({ kidqScore: 85 });
    const popular = candidate({ kidqScore: 80 });
    const withPopularity: CandidateInput[] = [
      Object.assign({}, popular, { viewCount: 10_000_000, likes: 500_000 }),
      Object.assign({}, better, { viewCount: 10 }),
    ];
    expect(recommend(profile, withPopularity, config, new Set()).map((r) => r.contentId)).toEqual([better.id, popular.id]);
  });

  it("pages with offset and keeps absolute ranks", () => {
    const items = Array.from({ length: 5 }, (_, i) => candidate({ kidqScore: 90 - i }));
    const page = recommend(profile, items, config, new Set(), { limit: 2, offset: 2 });
    expect(page.map((r) => r.rank)).toEqual([3, 4]);
    expect(page[0].contentId).toBe(items[2].id);
  });
});

describe("childAgeYears", () => {
  it("computes age in years to one decimal", () => {
    expect(childAgeYears(2022, 3, new Date(Date.UTC(2026, 8, 12)))).toBe(4.5);
  });
});
