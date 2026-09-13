import { describe, expect, it } from "vitest";
import { parseQuotaError } from "../../src/ai/gemini";

const quotaBody = (quotaId: string, retryDelay?: string) => ({
  error: {
    code: 429,
    status: "RESOURCE_EXHAUSTED",
    details: [
      { "@type": "type.googleapis.com/google.rpc.QuotaFailure", violations: [{ quotaId }] },
      ...(retryDelay ? [{ "@type": "type.googleapis.com/google.rpc.RetryInfo", retryDelay }] : []),
    ],
  },
});

describe("Gemini quota errors", () => {
  it("waits for the daily reset when a per-day quota is used up", () => {
    expect(parseQuotaError(quotaBody("GenerateRequestsPerDayPerProjectPerModel-FreeTier", "12s"))).toEqual({ daily: true, retryAfterMs: 12_000 });
  });

  it("uses RetryInfo's delay for per-minute limits", () => {
    expect(parseQuotaError(quotaBody("GenerateContentInputTokensPerModelPerMinute-FreeTier", "43.2s"))).toEqual({ daily: false, retryAfterMs: 43_200 });
  });

  it("falls back to a one-minute wait when the body has no details", () => {
    expect(parseQuotaError(null)).toEqual({ daily: false, retryAfterMs: 60_000 });
    expect(parseQuotaError({ error: { details: "unexpected" } })).toEqual({ daily: false, retryAfterMs: 60_000 });
  });
});
