import type { AgeBand } from "./parent-config";
import type { MascotColorId } from "@/lib/mascot-colors";

export interface ChildProfile {
  id: string;
  uid: string;
  nickname: string;
  ageBand: AgeBand;
  mascotColor: MascotColorId;
  createdAt: string;
  ageBandAssignedAt: string;
  lastUsedDurationMinutes: number | null;
  lastTimeBandMode: "auto" | "morning" | "daytime" | "bedtime";
}

export interface CreateChildInput {
  nickname: string;
  ageBand: AgeBand;
  mascotColor: MascotColorId;
}
