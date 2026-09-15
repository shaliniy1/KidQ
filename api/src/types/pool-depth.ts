import type { AgeBand } from "./parent-config";

export interface PoolDepthEntry {
  ageBand: AgeBand;
  category: string;
  count: number;
  isThin: boolean;
}

export interface PoolDepthReport {
  threshold: number;
  generatedAt: string;
  entries: PoolDepthEntry[];
  thinCombinations: PoolDepthEntry[];
}
