import { describe, expect, it } from "vitest";
import { ageFit, eligibilityProblems, recommend, type CandidateInput, type ChildProfileInput, type RankingConfig } from "../../src/domain/recommendation";

const config: RankingConfig = {
  version: "RANK_V3",
  weights: { relevance: 0.45, score: 0.3, learning: 0.15, preference: 0.1 },
  params: {
    relevanceWeights: { interests: 0.4, developmentGoals: 0.3, regulationGoals: 0.2, category: 0.1 },
    maxPerCreatorInTop: 3,
    topWindow: 20,
    dismissCooldownDays: 14,
  },
};

const profile: ChildProfileInput = {
  ageYears: 4,
  languages: ["en"],
  interests: ["animals", "space"],
  developmentGoals: ["social"],
  regulationGoals: ["calm"],
  contentMix: "SURPRISE",
  preferredCategories: [],
  sessionMinutes: 30,
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
    category: "general_knowledge",
    categories: [],
    interests: ["animals"],
    developmentGoals: ["social"],
    regulationGoals: [],
    durationSeconds: 300,
    creator: `creator-${counter}`,
    kidqScore: 80,
    learningValue: null,
    ...overrides,
  };
}

const ids = (profileInput: ChildProfileInput, candidates: CandidateInput[]) =>
  recommend(profileInput, candidates, config, new Set()).map((r) => r.contentId);

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
    ];
    expect(ids(profile, [good, ...rejected])).toEqual([good.id]);
  });

  it("says why a published item can't be recommended", () => {
    expect(eligibilityProblems(candidate())).toEqual([]);
    expect(eligibilityProblems(candidate({ playable: false, kidqScore: null, developmentGoals: [], regulationGoals: [] }))).toEqual(["NOT_PLAYABLE", "NOT_SCORED", "NO_GOAL"]);
  });

  it("shows only the chosen categories when the parent picks them, and a mix otherwise", () => {
    const science = candidate({ category: "science" });
    const nature = candidate({ category: "general_knowledge" });
    const chosen: ChildProfileInput = { ...profile, contentMix: "CHOSEN", preferredCategories: ["science"] };
    expect(ids(chosen, [science, nature])).toEqual([science.id]);
    expect(ids(profile, [science, nature])).toHaveLength(2);
  });

  it("matches every category an item fits when the parent chooses categories", () => {
    const countingBook = candidate({ contentType: "STORYBOOK", category: "storybooks", categories: ["storybooks", "maths"] });
    const song = candidate({ category: "music_rhymes", categories: ["music_rhymes"] });
    const maths: ChildProfileInput = { ...profile, contentMix: "CHOSEN", preferredCategories: ["maths"] };
    expect(ids(maths, [countingBook, song])).toEqual([countingBook.id]);
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

  it("never shows two items of one category side by side while another category is left", () => {
    const books = [95, 94, 93].map((kidqScore) => candidate({ contentType: "STORYBOOK", category: "storybooks", kidqScore }));
    const science = [80, 79].map((kidqScore) => candidate({ category: "science", kidqScore }));
    expect(ids(profile, [...books, ...science])).toEqual([books[0].id, science[0].id, books[1].id, science[1].id, books[2].id]);
  });

  it("mixes categories in the default feed of a child whose parent gave only an age", () => {
    // A 4–5 band child: no interests, SURPRISE, and the band's default development goals.
    const ageOnly: ChildProfileInput = { ...profile, ageYears: 4.5, interests: [], developmentGoals: ["cognitive", "creativity", "problem_solving"], regulationGoals: [] };
    const library = [
      ...[96, 95, 94, 93].map((kidqScore) => candidate({ contentType: "STORYBOOK", category: "storybooks", kidqScore, developmentGoals: ["cognitive"] })),
      candidate({ category: "music_rhymes", kidqScore: 85, developmentGoals: ["creativity"] }),
      candidate({ category: "science", kidqScore: 84, developmentGoals: ["cognitive"] }),
    ];
    const feed = ids(ageOnly, library).map((id) => library.find((item) => item.id === id)?.category);
    expect(feed.slice(0, 4)).toEqual(["storybooks", "music_rhymes", "storybooks", "science"]);
  });

  it("caps any one creator at 3 inside the top window", () => {
    const sameCreator = Array.from({ length: 5 }, () => candidate({ creator: "One Channel", kidqScore: 95 }));
    const others = Array.from({ length: 3 }, () => candidate({ kidqScore: 60 }));
    const ranked = ids(profile, [...sameCreator, ...others]);
    const sameIds = new Set(sameCreator.map((c) => c.id));
    expect(ranked.slice(0, 6).filter((id) => sameIds.has(id))).toHaveLength(3);
    expect(ranked).toHaveLength(8);
  });

  it("prefers items made for the child's age over items that merely allow it", () => {
    expect(ageFit(5, 4, 6)).toBe(1);
    expect(ageFit(4, 4, 6)).toBe(0.5);
    expect(ageFit(5, 0, 6)).toBeCloseTo(2 / 3, 5);
    const allowed = candidate({ ageMin: 0, ageMax: 6 });
    const madeFor = candidate({ ageMin: 4, ageMax: 6 });
    expect(ids({ ...profile, ageYears: 5 }, [allowed, madeFor])).toEqual([madeFor.id, allowed.id]);
  });

  it("ranks more learning value first when everything else is equal", () => {
    const little = candidate({ learningValue: 25 });
    const rich = candidate({ learningValue: 75 });
    expect(ids(profile, [little, rich])).toEqual([rich.id, little.id]);
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
    expect(ids(profile, withPopularity)).toEqual([better.id, popular.id]);
  });

  it("pages with offset and keeps absolute ranks", () => {
    const items = Array.from({ length: 5 }, (_, i) => candidate({ kidqScore: 90 - i }));
    const page = recommend(profile, items, config, new Set(), { limit: 2, offset: 2 });
    expect(page.map((r) => r.rank)).toEqual([3, 4]);
    expect(page[0].contentId).toBe(items[2].id);
  });
});
