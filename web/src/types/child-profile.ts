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
}

export interface CreateChildInput {
  nickname: string;
  ageBand: AgeBand;
  mascotColor: MascotColorId;
}
