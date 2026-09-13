import { describe, expect, it } from "vitest";
import { expertLabel } from "../../src/domain/experts";

describe("expertLabel", () => {
  it("counts KidQ-verified experts", () => {
    expect(expertLabel({ recommend: 3, total: 3, verified: 3, verifiedRecommend: 3 })).toBe("Recommended by 3 KidQ experts");
    expect(expertLabel({ recommend: 1, total: 1, verified: 1, verifiedRecommend: 1 })).toBe("Recommended by 1 KidQ expert");
    expect(expertLabel({ recommend: 3, total: 4, verified: 4, verifiedRecommend: 3 })).toBe("3 of 4 KidQ experts recommend it");
  });

  it("calls unverified reviews public reviews, never experts", () => {
    expect(expertLabel({ recommend: 2, total: 2, verified: 0, verifiedRecommend: 0 })).toBe("Recommended in 2 public reviews");
    expect(expertLabel({ recommend: 1, total: 2, verified: 0, verifiedRecommend: 0 })).toBe("1 of 2 public reviews recommend it");
  });
});
