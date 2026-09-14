/**
 * Seed/demo data for api/data/content.jsonl — see INTEGRATION_NOTES.md #4.
 * Exists so Session Assembly's actual algorithm (greedy fill, category
 * rotation, calm-final-slot, adjacent-age-band fallback) can be proven
 * working end-to-end, not just typechecked against an empty catalog. Not
 * real content — titles/channels/durations are illustrative placeholders.
 *
 * Re-run with: npx tsx scripts/seed-content-catalog.ts
 * (appends — delete api/data/content.jsonl first to reseed from scratch)
 */
import { saveContent } from "../src/services/content-store";
import type { AgeBand } from "../src/types/parent-config";
import type { KidqContentRecord } from "../src/types/content";

interface SeedSpec {
  title: string;
  category: string;
  ageBands: AgeBand[];
  durationSeconds: number;
  channel: string;
}

const SEEDS: SeedSpec[] = [
  // 0-2
  { title: "Peekaboo Animal Friends", category: "Animation", ageBands: ["0-2"], durationSeconds: 210, channel: "Little Sprouts" },
  { title: "Soft Lullaby Rhymes", category: "Music/Rhymes", ageBands: ["0-2"], durationSeconds: 240, channel: "Hush Little Tunes" },
  { title: "Colors and Shapes for Baby", category: "Educational", ageBands: ["0-2", "2-3"], durationSeconds: 300, channel: "Tiny Learners" },
  // 2-3
  { title: "The Sleepy Bunny's Bedtime", category: "Storybooks", ageBands: ["2-3"], durationSeconds: 320, channel: "Storytime Nook" },
  { title: "Counting with Farm Animals", category: "Maths", ageBands: ["2-3", "3-4"], durationSeconds: 280, channel: "Tiny Learners" },
  { title: "Wiggle and Giggle Dance-Along", category: "Activities", ageBands: ["2-3"], durationSeconds: 260, channel: "Move & Groove Kids" },
  { title: "Gentle Toddler Yoga", category: "Yoga", ageBands: ["2-3", "3-4"], durationSeconds: 300, channel: "Calm Cubs" },
  // 3-4
  { title: "Adventures of Mango the Fox", category: "Animation", ageBands: ["3-4"], durationSeconds: 480, channel: "Storyverse" },
  { title: "Rainy Day Crafts: Paper Boats", category: "Crafts", ageBands: ["3-4"], durationSeconds: 360, channel: "Craft Corner Kids" },
  { title: "Splash of Color Painting Time", category: "Painting", ageBands: ["3-4", "4-5"], durationSeconds: 340, channel: "Craft Corner Kids" },
  { title: "The Three Little Pigs — Read Aloud", category: "Stories", ageBands: ["3-4"], durationSeconds: 400, channel: "Storytime Nook" },
  { title: "Calm Down Breathing Buddies", category: "Yoga", ageBands: ["3-4", "4-5"], durationSeconds: 220, channel: "Calm Cubs" },
  // 4-5
  { title: "Why Do Leaves Change Color?", category: "Science", ageBands: ["4-5"], durationSeconds: 420, channel: "Curious Sprouts" },
  { title: "Shapes, Patterns and Puzzles", category: "Maths", ageBands: ["4-5"], durationSeconds: 380, channel: "Tiny Learners" },
  { title: "Kindness Club: Sharing Stories", category: "Stories", ageBands: ["4-5", "5-6"], durationSeconds: 360, channel: "Storyverse" },
  { title: "Bedtime Wind-Down Storybook", category: "Storybooks", ageBands: ["4-5", "5-6"], durationSeconds: 300, channel: "Storytime Nook" },
  // 5-6
  { title: "How Rockets Reach Space", category: "Science", ageBands: ["5-6"], durationSeconds: 500, channel: "Curious Sprouts" },
  { title: "World Map Explorers", category: "Knowledge/General Learning", ageBands: ["5-6"], durationSeconds: 440, channel: "Curious Sprouts" },
  { title: "Addition Adventures", category: "Maths", ageBands: ["5-6"], durationSeconds: 360, channel: "Tiny Learners" },
  { title: "Evening Stretch and Settle", category: "Yoga", ageBands: ["5-6"], durationSeconds: 260, channel: "Calm Cubs" },
];

function toRecord(spec: SeedSpec, index: number): KidqContentRecord {
  const id = `seed-${String(index + 1).padStart(3, "0")}`;
  return {
    content_id: id,
    content_type: "VIDEO",
    title: spec.title,
    source: "youtube",
    source_url: `https://www.youtube.com/watch?v=seed${index + 1}`,
    embed_url: `https://www.youtube.com/embed/seed${index + 1}`,
    source_video_id: `seed${index + 1}`,
    channel_or_creator: spec.channel,
    thumbnail_url: null,
    duration_seconds: spec.durationSeconds,
    language: "en",
    caption_available: true,
    transcript: null,
    transcript_source: null,
    description: null,
    made_for_kids: true,
    embeddable: true,
    license_if_known: null,
    category: spec.category,
    subcategory: null,
    age_min: null,
    age_max: null,
    age_band: spec.ageBands,
    learning_objective: null,
    skills_developed: [],
    topics: [],
    keywords: [],
    activity_supported: false,
    activity_title: null,
    activity_instruction: null,
    activity_duration_seconds: null,
    activity_type: null,
    filter_out: {},
    filter_in: {},
    filter_out_fail_count: 0,
    filter_in_pass_count: 0,
    content_status: "APPROVED",
    rejection_reason: null,
    manual_review_reason: null,
    kidq_summary: `Seed/demo record for local Session Assembly testing — ${spec.title}.`,
    fetched_at: new Date().toISOString(),
    provenance: { method: "youtube_data_api", inspected_fields: [], audiovisual_inspected: false },
  };
}

async function main() {
  const records = SEEDS.map(toRecord);
  await saveContent(records);
  console.log(`Seeded ${records.length} demo content records into api/data/content.jsonl`);
}

main();
