import { randomUUID } from "node:crypto";
import { createJsonFileStore } from "../lib/json-file-store";
import type { ChildProfile, CreateChildInput } from "../types/child-profile";

const children = createJsonFileStore<ChildProfile>("children.json");

export async function listChildren(uid: string): Promise<ChildProfile[]> {
  const all = await children.readAll();
  return Object.values(all).filter((child) => child.uid === uid);
}

/** Creates one child profile per input, in add order (mascotColor is already resolved client-side, see web/src/lib/mascot-colors.ts). */
export async function createChildren(uid: string, inputs: CreateChildInput[]): Promise<ChildProfile[]> {
  const created: ChildProfile[] = [];
  await children.write((all) => {
    const now = new Date().toISOString();
    for (const input of inputs) {
      const child: ChildProfile = {
        id: randomUUID(),
        uid,
        nickname: input.nickname,
        ageBand: input.ageBand,
        mascotColor: input.mascotColor,
        createdAt: now,
        ageBandAssignedAt: now,
      };
      all[child.id] = child;
      created.push(child);
    }
  });
  return created;
}
