import crypto from "node:crypto";
import type { ContentType, CriterionAssessment, DiscoveryRequest, KidqContentRecord } from "../types/content";

const YOUTUBE_API = "https://www.googleapis.com/youtube/v3";
const blockedTerms = /violence|violent|fight|weapon|killing|scary|horror|monster|prank|unboxing|toy review|surprise egg|buy now|giveaway|clickbait|shocking/i;

function assessment(status: CriterionAssessment["status"], evidence: string): CriterionAssessment {
  return { status, evidence };
}

function classify(title: string, description: string): { category: string; contentType: ContentType } {
  const text = `${title} ${description}`.toLowerCase();
  const category = /story|read aloud|storybook/.test(text) ? "Storybooks / Read-Alouds" :
    /craft|draw|paint|color/.test(text) ? "Creative Crafts" :
    /yoga|stretch|movement|dance/.test(text) ? "Yoga & Movement" :
    /animal|fish|guppy|nature/.test(text) ? "Animals / Nature" :
    /math|count|number|shape|color|alphabet|phonics|letter/.test(text) ? "Baby Learning" : "Activities";
  const contentType = /story|read aloud|storybook/.test(text) ? "STORYBOOK" : "VIDEO";
  return { category, contentType };
}

function parseDuration(value?: string) {
  if (!value) return undefined;
  const match = value.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return undefined;
  return Number(match[1] || 0) * 3600 + Number(match[2] || 0) * 60 + Number(match[3] || 0);
}

type DiscoveryInput = Partial<KidqContentRecord> & Pick<KidqContentRecord, "content_id" | "content_type" | "title" | "source" | "source_url" | "caption_available" | "activity_supported" | "fetched_at" | "provenance">;

function evaluate(input: DiscoveryInput): KidqContentRecord {
  const text = `${input.title} ${input.description || ""} ${input.transcript || ""}`;
  const hasBlockedTerm = blockedTerms.test(text);
  const filterOut = {
    high_stimulation: assessment("UNKNOWN", "Audiovisual pacing, flashing and sound were not inspected by this ingestion pipeline."),
    inappropriate_themes: hasBlockedTerm ? assessment("FAIL", "Title, description, or transcript contains a blocked term.") : assessment("UNKNOWN", "Text signals did not establish absence of inappropriate themes."),
    advertising_or_commercial: /sponsor|advertis|shop|product|subscribe/i.test(text) ? assessment("FAIL", "Promotional language found in metadata or transcript.") : assessment("UNKNOWN", "Commercial content requires manual inspection."),
    manipulative_design: assessment("UNKNOWN", "Thumbnail and playback behavior were not inspected."),
    poor_developmental_value: assessment("UNKNOWN", "Metadata cannot prove developmental value."),
  };
  const filterIn = {
    clear_learning_objective: /learn|teach|count|letter|color|shape|story|draw|make|practice/i.test(text) ? assessment("PASS", "Learning or creative intent is visible in text.") : assessment("UNKNOWN", "No explicit objective was found."),
    low_stimulation: assessment("UNKNOWN", "Requires human audiovisual review."),
    positive_social_emotional: /kind|share|help|feel|emotion|friend/i.test(text) ? assessment("PASS", "Positive social-emotional language found.") : assessment("UNKNOWN", "Not established from available text."),
    interactive_engagement: /sing|clap|move|copy|guess|find|draw|make|question/i.test(text) ? assessment("PASS", "Participation prompt found in text.") : assessment("UNKNOWN", "No participation prompt was found."),
    offline_activity_potential: /craft|draw|paint|find|count|make|stretch|yoga|nature/i.test(text) ? assessment("PASS", "Text suggests an offline extension.") : assessment("UNKNOWN", "No offline extension was found."),
    age_appropriate: assessment("UNKNOWN", "Age suitability requires curator review."),
  };
  const failCount = Object.values(filterOut).filter((item) => item.status === "FAIL").length;
  const passCount = Object.values(filterIn).filter((item) => item.status === "PASS").length;
  const status = failCount > 0 ? "REJECTED" : "MANUAL_REVIEW_REQUIRED";
  return {
    ...input,
    embed_url: input.embed_url || null,
    source_video_id: input.source_video_id || null,
    channel_or_creator: input.channel_or_creator || null,
    thumbnail_url: input.thumbnail_url || null,
    duration_seconds: input.duration_seconds ?? null,
    language: input.language || null,
    transcript: input.transcript || null,
    transcript_source: input.transcript_source || null,
    description: input.description || null,
    made_for_kids: input.made_for_kids ?? null,
    embeddable: input.embeddable ?? null,
    license_if_known: input.license_if_known || null,
    category: input.category || null,
    subcategory: input.subcategory || null,
    age_min: input.age_min ?? null,
    age_max: input.age_max ?? null,
    age_band: input.age_band || [],
    learning_objective: input.learning_objective || null,
    skills_developed: input.skills_developed || [],
    topics: input.topics || [],
    keywords: input.keywords || [],
    activity_title: input.activity_title || null,
    activity_instruction: input.activity_instruction || null,
    activity_duration_seconds: input.activity_duration_seconds ?? null,
    activity_type: input.activity_type || null,
    filter_out: filterOut,
    filter_in: filterIn,
    filter_out_fail_count: failCount,
    filter_in_pass_count: passCount,
    content_status: status,
    rejection_reason: failCount > 0 ? "One or more exclusion signals were found." : null,
    manual_review_reason: status === "MANUAL_REVIEW_REQUIRED" ? "Metadata/transcript alone cannot verify low stimulation, age fit, or audiovisual safety." : null,
    kidq_summary: status === "REJECTED" ? "This candidate contains an exclusion signal and should not enter the KidQ library." : "This candidate has promising textual signals but must pass human review of the actual content before approval.",
  };
}

async function youtube(request: DiscoveryRequest): Promise<KidqContentRecord[]> {
  const key = process.env.YOUTUBE_DATA_API_KEY;
  if (!key) throw new Error("YOUTUBE_DATA_API_KEY is required for YouTube discovery; KidQ never scrapes YouTube.");
  const params = new URLSearchParams({ part: "snippet", q: request.query, type: "video", safeSearch: "strict", videoEmbeddable: "true", maxResults: String(Math.min(request.max_results || 10, 50)), key });
  if (request.region_code) params.set("regionCode", request.region_code);
  if (request.language) params.set("relevanceLanguage", request.language);
  const search = await fetch(`${YOUTUBE_API}/search?${params}`).then(async (r) => { if (!r.ok) throw new Error(`YouTube search failed: ${r.status}`); return r.json() as Promise<any>; });
  const ids = search.items.map((item: any) => item.id.videoId).filter(Boolean).join(",");
  if (!ids) return [];
  const metadata = await fetch(`${YOUTUBE_API}/videos?part=snippet,contentDetails,status,topicDetails&id=${ids}&key=${key}`).then(async (r) => { if (!r.ok) throw new Error(`YouTube metadata failed: ${r.status}`); return r.json() as Promise<any>; });
  return metadata.items.map((item: any) => {
    const { category, contentType } = classify(item.snippet.title, item.snippet.description || "");
    return evaluate({ content_id: `youtube:${item.id}`, content_type: contentType, title: item.snippet.title, source: "youtube", source_url: `https://www.youtube.com/watch?v=${item.id}`, embed_url: `https://www.youtube.com/embed/${item.id}`, source_video_id: item.id, channel_or_creator: item.snippet.channelTitle, thumbnail_url: item.snippet.thumbnails?.high?.url || item.snippet.thumbnails?.default?.url, duration_seconds: parseDuration(item.contentDetails?.duration) ?? null, language: item.snippet.defaultAudioLanguage || item.snippet.defaultLanguage || request.language || null, caption_available: Boolean(item.contentDetails?.caption === "true"), made_for_kids: item.status?.madeForKids ?? null, embeddable: item.status?.embeddable ?? null, license_if_known: item.status?.license || null, transcript: null, transcript_source: null, description: item.snippet.description || null, category, subcategory: null, age_min: null, age_max: null, age_band: [], learning_objective: null, skills_developed: [], topics: [], keywords: [], activity_supported: false, activity_title: null, activity_instruction: null, activity_duration_seconds: null, activity_type: null, fetched_at: new Date().toISOString(), provenance: { method: "youtube_data_api", inspected_fields: ["snippet", "contentDetails", "status"], audiovisual_inspected: false } });
  });
}

function htmlText(html: string, pattern: RegExp) { return html.match(pattern)?.[1]?.replace(/<[^>]+>/g, " ").replace(/\\s+/g, " ").trim(); }

async function openWeb(request: DiscoveryRequest): Promise<KidqContentRecord[]> {
  const urls = request.open_urls || [];
  return Promise.all(urls.map(async (sourceUrl) => {
    const response = await fetch(sourceUrl, { headers: { "user-agent": "KidQ-content-ingestion/0.1 (contact: content@kidq.local)" } });
    if (!response.ok) throw new Error(`Open source fetch failed (${response.status}): ${sourceUrl}`);
    const html = await response.text();
    const title = htmlText(html, /<title[^>]*>([\s\S]*?)<\/title>/i) || sourceUrl;
    const description = htmlText(html, /<meta[^>]+(?:name|property)=["'](?:description|og:description)["'][^>]+content=["']([^"']*)["']/i);
    const transcript = htmlText(html, /<(?:div|section|article)[^>]+(?:transcript|read-aloud|story-text)[^>]*>([\s\S]*?)<\/(?:div|section|article)>/i);
    const { category, contentType } = classify(title, `${description || ""} ${transcript || ""}`);
    return evaluate({ content_id: `open:${crypto.createHash("sha256").update(sourceUrl).digest("hex").slice(0, 16)}`, content_type: contentType, title, source: "open_web", source_url: sourceUrl, embed_url: html.match(/<iframe[^>]+src=["']([^"']+)["']/i)?.[1] || null, source_video_id: null, channel_or_creator: null, thumbnail_url: null, duration_seconds: null, language: request.language || null, transcript: transcript || null, transcript_source: transcript ? sourceUrl : null, description: description || null, caption_available: Boolean(transcript), made_for_kids: null, embeddable: null, license_if_known: htmlText(html, /<meta[^>]+(?:name|property)=["'](?:license|dc.rights)["'][^>]+content=["']([^"']*)["']/i) || null, category, subcategory: null, age_min: null, age_max: null, age_band: [], learning_objective: null, skills_developed: [], topics: [], keywords: [], activity_supported: false, activity_title: null, activity_instruction: null, activity_duration_seconds: null, activity_type: null, fetched_at: new Date().toISOString(), provenance: { method: "open_web_fetch", inspected_fields: ["title", "description", "visible transcript", "first iframe", "license metadata"], audiovisual_inspected: false } });
  }));
}

export async function discoverContent(request: DiscoveryRequest) {
  if (request.source === "youtube") return youtube(request);
  if (request.source === "open_web") return openWeb(request);
  throw new Error("Choose source=youtube or source=open_web.");
}
