export type ActivityStatus = "LIVE" | "SPEC'D" | "NEW CONCEPT";
export type ActivityCategory = "moving" | "calmer";

export type KidQActivity = {
  key: string;
  name: string;
  category: ActivityCategory;
  status: ActivityStatus;
  duration: number;
  instruction: string;
  asset?: string;
};

export const activityCatalog: KidQActivity[] = [
  { key: "find", name: "Find 3 Colours", category: "moving", status: "LIVE", duration: 3, instruction: "Find three things in the colour shown." },
  { key: "tree", name: "Tree Pose", category: "moving", status: "SPEC'D", duration: 3, instruction: "Stand tall and balance like a tree." },
  { key: "butterfly_wings", name: "Butterfly Wings", category: "moving", status: "NEW CONCEPT", duration: 3, instruction: "Move your arms slowly like butterfly wings." },
  { key: "puddle_jump", name: "Puddle Jump", category: "moving", status: "NEW CONCEPT", duration: 3, instruction: "Make three gentle pretend puddle jumps." },
  { key: "cloud_reach", name: "Cloud Reach", category: "moving", status: "NEW CONCEPT", duration: 3, instruction: "Reach up high, then relax your arms." },
  { key: "follow", name: "Catch the Sun", category: "calmer", status: "LIVE", duration: 3, instruction: "Follow the sun slowly with your eyes." },
  { key: "breathe", name: "Flower & Candle", category: "calmer", status: "LIVE", duration: 3, instruction: "Smell the flower, then blow the candle." },
  { key: "breathe_sun", name: "Breathe with Sun", category: "calmer", status: "LIVE", duration: 3, instruction: "Take three slow breaths with the sun." },
  { key: "sleepy_stretch", name: "Sleepy Stretch", category: "calmer", status: "NEW CONCEPT", duration: 3, instruction: "Stretch gently and settle your body." },
  { key: "firefly_count", name: "Firefly Count", category: "calmer", status: "NEW CONCEPT", duration: 3, instruction: "Count five soft fireflies as they glow." },
];
