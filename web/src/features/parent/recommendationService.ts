export type ParentRecommendation = {
  id: string;
  title: string;
  duration: number;
  category: string;
  ageRange: string;
  thumbnailUrl?: string;
  previewUrl?: string;
  reason: string;
  guardrails: string[];
  visibility?: "private" | "public_candidate";
};

const catalog: ParentRecommendation[] = [
  { id: "bunny", title: "The Bunny Wakes Up", duration: 8, category: "Stories", ageRange: "3–5", reason: "Matches an interest in gentle animal stories", guardrails: ["Low stimulation", "Age appropriate"], visibility: "public_candidate" },
  { id: "counting", title: "Counting With Friends", duration: 7, category: "Maths", ageRange: "3–6", reason: "Builds on early numbers and pattern play", guardrails: ["Clear language", "Age appropriate"] },
  { id: "birds", title: "Why Do Birds Fly?", duration: 6, category: "Science", ageRange: "4–7", reason: "Connects with nature and curiosity", guardrails: ["Calm pacing", "Safe themes"] },
  { id: "paint", title: "Paint With Me", duration: 5, category: "Creative", ageRange: "3–6", reason: "Offers an offline-friendly creative prompt", guardrails: ["Gentle audio", "Low stimulation"] },
  { id: "stretch", title: "Morning Stretch", duration: 5, category: "Movement", ageRange: "3–8", reason: "Adds a short movement transition", guardrails: ["Age appropriate", "Safe themes"] },
  { id: "fox", title: "The Kind Little Fox", duration: 7, category: "Stories", ageRange: "3–6", reason: "Fits a preference for imaginative stories", guardrails: ["Good language", "Calm pacing"] },
];

export function getMockRecommendations(child: { age: string }, duration: number): ParentRecommendation[] {
  const eligible = catalog.filter((item) => item.ageRange.includes(child.age.split("–")[0]) || item.category === "Movement");
  const source = eligible.length >= 3 ? eligible : catalog;
  const result: ParentRecommendation[] = [];
  let total = 0;
  for (const item of source) {
    if (total + item.duration > duration - 2 && result.length > 1) continue;
    result.push(item);
    total += item.duration;
    if (total >= Math.min(duration - 2, 28)) break;
  }
  return result;
}
