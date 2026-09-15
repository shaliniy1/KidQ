import { vi } from "vitest";

export interface FakeApis {
  youtube: Map<string, object>;
  /** Queue of Gemini responses, consumed one per generateContent call: a response text or an HTTP error. */
  gemini: Array<string | { status: number; body: unknown }>;
  /** StoryWeaver search hits, and each story's reader pages by slug. */
  storyweaver: { hits: object[]; reads: Map<string, object[]> };
  calls: string[];
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

export function fakeApis(): FakeApis {
  return { youtube: new Map(), gemini: [], storyweaver: { hits: [], reads: new Map() }, calls: [] };
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
      if (typeof text !== "string") return json(text.body, text.status);
      return json({
        candidates: [{ content: { parts: [{ text }] }, finishReason: "STOP" }],
        usageMetadata: { promptTokenCount: 30_000, candidatesTokenCount: 1_500 },
        modelVersion: "gemini-test-snapshot",
      });
    }
    if (url.startsWith("https://storyweaver.org.in/api/v1/books-search")) {
      return json({ ok: true, metadata: { totalPages: 1 }, data: apis.storyweaver.hits });
    }
    const read = url.match(/^https:\/\/storyweaver\.org\.in\/api\/v1\/stories\/([^/?]+)\/read/);
    if (read) {
      const pages = apis.storyweaver.reads.get(decodeURIComponent(read[1]));
      return pages ? json({ ok: true, data: { pages } }) : json({ ok: false }, 404);
    }
    if (url.startsWith("https://storage.googleapis.com/static.storyweaver.org.in/")) {
      return new Response(new Uint8Array([255, 216, 255, 224]), { status: 200, headers: { "content-type": "image/jpeg" } });
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

const pass = (key: string, evidence: string): Criterion => ({ key, result: "PASS", evidence, timestamps: [] });
// A full review of a calm video: every check that needs watching and listening is answered.
const CALM_VIDEO_CHECKS: Criterion[] = [
  pass("rapid_visual_cuts", "Long, slow shots."),
  pass("flashing_or_excessive_contrast", "Soft colours and no flashing."),
  pass("loud_or_jarring_audio", "Quiet, even music."),
  pass("cluttered_visuals", "One object on screen at a time."),
  pass("frightening_imagery", "Nothing scary."),
  pass("slow_deliberate_pacing", "Time to follow each count."),
  pass("gentle_soothing_audio", "Gentle narration."),
  pass("simple_uncluttered_visuals", "Plain backgrounds."),
];
const CALM_VIDEO_OBSERVATIONS = {
  cuts_per_minute: 6,
  motion: "LOW",
  palette: "SOFT_NATURAL",
  flashing_moments: [],
  loudness: "QUIET_EVEN",
  sudden_loud_moments: [],
  speech_pace: "SLOW",
  music: "CALM",
  on_screen_text: "SOME",
  clutter: "LOW",
  intended_audience: "YOUNG_CHILDREN",
};

export function agentOutput(
  overrides: {
    scores?: [number, number, number, number];
    criteria?: Criterion[];
    confidence?: number;
    observations?: Record<string, unknown>;
    classification?: Record<string, unknown>;
  } = {},
) {
  const [content, pacing, visual, audio] = overrides.scores ?? [96, 78, 89, 87];
  const component = (score: number, evidence: string) => ({ score, evidence, timestamps: ["00:42"], self_confidence: overrides.confidence ?? 0.9 });
  return JSON.stringify({
    observations: { ...CALM_VIDEO_OBSERVATIONS, ...overrides.observations },
    components: {
      CONTENT_LANGUAGE: component(content, "Gentle narration; no unsafe language."),
      PACING: component(pacing, "Slow scene changes, about six cuts per minute."),
      VISUAL_COMFORT: component(visual, "Soft colours and no flashing."),
      AUDIO_COMFORT: component(audio, "Calm music without sudden peaks."),
    },
    criteria: overrides.criteria ?? [
      { key: "clear_learning_objective", result: "PASS", evidence: "Counts from one to five on screen.", timestamps: ["00:10"] },
      { key: "physical_violence", result: "PASS", evidence: "No violence is shown.", timestamps: [] },
      ...CALM_VIDEO_CHECKS,
    ],
    classification: {
      age_min: 2,
      age_max: 4,
      category: "maths",
      also_fits: [],
      interests: ["numbers"],
      development_goals: ["cognitive"],
      regulation_goals: ["calm"],
      language: "en",
      ...overrides.classification,
    },
    learning_objective: "Count objects from one to five.",
    kidq_summary: "A calm counting video with gentle music. Children count along from one to five. Extra sentence is dropped.",
  });
}

/** A StoryWeaver search hit and its reader pages, shaped like the live API (2 story pages). */
export function storyweaverBook(id: number, options: { license?: string; title?: string } = {}) {
  const slug = `${id}-a-rainy-day`;
  const image = (n: number) => ({
    sizes: [308, 428, 708].map((width, index) => ({
      width,
      height: width / 2,
      url: `https://storage.googleapis.com/static.storyweaver.org.in/illustration_crops/${id}${n}/size${index + 2}/page.jpg`,
    })),
  });
  const title = options.title ?? "A Rainy Day";
  const hit = {
    id,
    title,
    language: "English",
    level: "1",
    slug,
    description: "Manu waits all week for the rain.",
    coverImage: image(0),
    authors: [{ name: "Kiran Kasturia" }],
    illustrators: [{ name: "Zainab Tambawalla" }],
    publisher: { name: "Pratham Books" },
    readsCount: 407244,
  };
  const pages = [
    { pagePostion: 1, pageType: "FrontCoverPage", html: `<div>${title}</div>`, coverImage: image(0) },
    {
      pagePostion: 2,
      pageType: "StoryPage",
      html: "<div class='content'><p><span>On Sunday, Manu&rsquo;s parents got him a red raincoat.</span></p></div><div>1/2</div><script>$(document).ready(function() {});</script>",
      coverImage: image(1),
    },
    { pagePostion: 3, pageType: "StoryPage", html: "<p>At last it rained, and Manu danced.</p> 2/2", coverImage: image(2) },
    {
      pagePostion: 4,
      pageType: "BackInnerCoverPage",
      html: `<p>Story Attribution: This story: ${title} is written by Kiran Kasturia. © Pratham Books, 2015. Some rights reserved. Released under ${options.license ?? "CC BY 4.0"} license.</p><p>Illustration Attributions: Cover page: A boy in a raincoat, by Zainab Tambawalla © Pratham Books, 2015. Some rights reserved. Released under CC BY 4.0 license.</p>`,
    },
    { pagePostion: 5, pageType: "BackCoverPage", html: "<p>This is a Level 1 book for children who are eager to begin reading.</p>" },
  ];
  return { hit, pages };
}

/** The scoring agent's answer for a picture book: three components, no audio. */
export function storyAgentOutput(scores: [number, number, number] = [92, 85, 88]) {
  const [content, pacing, visual] = scores;
  const component = (score: number, evidence: string) => ({ score, evidence, timestamps: [], self_confidence: 0.9 });
  return JSON.stringify({
    observations: { palette: "SOFT_NATURAL", clutter: "LOW", intended_audience: "YOUNG_CHILDREN" },
    components: {
      CONTENT_LANGUAGE: component(content, "A gentle story about waiting for rain (p. 1–2)."),
      PACING: component(pacing, "One or two short sentences per page, with repetition (p. 1)."),
      VISUAL_COMFORT: component(visual, "Soft, uncluttered illustrations (p. 2)."),
    },
    criteria: [
      pass("physical_violence", "No violence on any page."),
      pass("flashing_or_excessive_contrast", "Soft watercolour pages (p. 1–2)."),
      pass("cluttered_visuals", "One scene per page."),
      pass("frightening_imagery", "Nothing scary."),
      pass("simple_uncluttered_visuals", "Manu is clear on every page."),
      pass("empathy_and_kindness", "Manu's parents help him get ready (p. 1)."),
    ],
    classification: {
      age_min: 2,
      age_max: 6,
      category: "storybooks",
      interests: ["stories", "weather"],
      development_goals: ["communication"],
      regulation_goals: [],
      language: "en",
    },
    learning_objective: "Notice how the weather changes from day to day.",
    kidq_summary: "Manu waits all week for rain so he can wear his new raincoat. A gentle, repetitive read-aloud about patience.",
  });
}

/** A Gemini 429 in its documented RESOURCE_EXHAUSTED shape (the free daily request quota by default). */
export function geminiQuotaError(quotaId = "GenerateRequestsPerDayPerProjectPerModel-FreeTier") {
  return {
    status: 429,
    body: {
      error: {
        code: 429,
        message: "You exceeded your current quota.",
        status: "RESOURCE_EXHAUSTED",
        details: [
          { "@type": "type.googleapis.com/google.rpc.QuotaFailure", violations: [{ quotaMetric: "generativelanguage.googleapis.com/generate_content_free_tier_requests", quotaId }] },
          { "@type": "type.googleapis.com/google.rpc.RetryInfo", retryDelay: "30s" },
        ],
      },
    },
  };
}
