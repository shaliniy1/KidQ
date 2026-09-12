import { vi } from "vitest";

export interface FakeApis {
  youtube: Map<string, object>;
  /** Queue of Gemini response texts, consumed one per generateContent call. */
  gemini: string[];
  calls: string[];
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

export function fakeApis(): FakeApis {
  return { youtube: new Map(), gemini: [], calls: [] };
}

export function installFakeApis(apis: FakeApis) {
  vi.stubGlobal("fetch", async (input: string | URL | Request) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    apis.calls.push(url);
    if (url.startsWith("https://www.googleapis.com/youtube/v3/videos")) {
      const ids = (new URL(url).searchParams.get("id") ?? "").split(",");
      return json({ items: ids.map((id) => apis.youtube.get(id)).filter(Boolean) });
    }
    if (url.includes(":generateContent")) {
      const text = apis.gemini.shift();
      if (text === undefined) return json({ error: { message: "no Gemini fixture left" } }, 400);
      return json({
        candidates: [{ content: { parts: [{ text }] }, finishReason: "STOP" }],
        usageMetadata: { promptTokenCount: 30_000, candidatesTokenCount: 1_500 },
        modelVersion: "gemini-test-snapshot",
      });
    }
    return json({ error: `unexpected request to ${url}` }, 404);
  });
}

export function youtubeVideo(id: string, overrides: { embeddable?: boolean; title?: string; duration?: string } = {}) {
  return {
    id,
    snippet: {
      title: overrides.title ?? "Calm counting to five",
      description: "Count from one to five with soft music.",
      channelTitle: "Gentle Numbers",
      thumbnails: {
        default: { url: `https://i.ytimg.com/vi/${id}/default.jpg` },
        high: { url: `https://i.ytimg.com/vi/${id}/hqdefault.jpg` },
      },
      tags: ["counting", "toddlers"],
      defaultAudioLanguage: "en",
      liveBroadcastContent: "none",
    },
    contentDetails: { duration: overrides.duration ?? "PT3M20S", caption: "true" },
    status: { privacyStatus: "public", embeddable: overrides.embeddable ?? true, license: "youtube", madeForKids: true },
    topicDetails: { topicCategories: ["https://en.wikipedia.org/wiki/Knowledge"] },
  };
}

type Criterion = { key: string; result: "PASS" | "FAIL" | "UNKNOWN"; evidence: string; timestamps: string[] };

export function agentOutput(overrides: { scores?: [number, number, number, number]; criteria?: Criterion[]; confidence?: number } = {}) {
  const [content, pacing, visual, audio] = overrides.scores ?? [96, 78, 89, 87];
  const component = (score: number, evidence: string) => ({ score, evidence, timestamps: ["00:42"], self_confidence: overrides.confidence ?? 0.9 });
  return JSON.stringify({
    components: {
      CONTENT_LANGUAGE: component(content, "Gentle narration; no unsafe language."),
      PACING: component(pacing, "Slow scene changes, about six cuts per minute."),
      VISUAL_COMFORT: component(visual, "Soft colours and no flashing."),
      AUDIO_COMFORT: component(audio, "Calm music without sudden peaks."),
    },
    criteria: overrides.criteria ?? [
      { key: "clear_learning_objective", result: "PASS", evidence: "Counts from one to five on screen.", timestamps: ["00:10"] },
      { key: "physical_violence", result: "PASS", evidence: "No violence is shown.", timestamps: [] },
    ],
    classification: {
      age_min: 2,
      age_max: 4,
      category: "maths",
      interests: ["numbers"],
      development_goals: ["cognitive"],
      regulation_goals: ["calm"],
      language: "en",
    },
    learning_objective: "Count objects from one to five.",
    kidq_summary: "A calm counting video with gentle music. Children count along from one to five. Extra sentence is dropped.",
  });
}
