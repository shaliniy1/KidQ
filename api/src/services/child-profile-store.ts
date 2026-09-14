import { randomUUID } from "node:crypto";
import { createJsonFileStore } from "../lib/json-file-store";
import type { ChildProfile, CreateChildInput } from "../types/child-profile";

const children = createJsonFileStore<ChildProfile>("children.json");

export async function listChildren(uid: string): Promise<ChildProfile[]> {
  const all = await children.readAll();
  return Object.values(all).filter((child) => child.uid === uid);
}

export async function getChildById(childId: string): Promise<ChildProfile | null> {
  const all = await children.readAll();
  return all[childId] ?? null;
}

/**
 * Ownership check every per-child route must use before reading or writing
 * anything scoped to a childId path param — a childId is not proof of
 * access on its own, only "owned by the requesting account" is.
 */
export async function assertChildOwnedBy(childId: string, uid: string): Promise<ChildProfile | null> {
  const child = await getChildById(childId);
  return child && child.uid === uid ? child : null;
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
