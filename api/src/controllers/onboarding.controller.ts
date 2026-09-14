import type { Request, Response } from "express";
import { completeOnboarding } from "../services/account-store";
import { createChildren, listChildren } from "../services/child-profile-store";
import { AGE_BANDS } from "../types/parent-config";
import { MASCOT_COLOR_IDS, type CreateChildInput } from "../types/child-profile";

const MAX_CHILDREN = 6;

function validateChildren(children: unknown): CreateChildInput[] | null {
  if (!Array.isArray(children) || children.length < 1 || children.length > MAX_CHILDREN) return null;

  const validated: CreateChildInput[] = [];
  for (const entry of children as Array<Record<string, unknown>>) {
    const nickname = typeof entry?.nickname === "string" ? entry.nickname.trim() : "";
    const ageBand = entry?.ageBand as (typeof AGE_BANDS)[number];
    const mascotColor = entry?.mascotColor as (typeof MASCOT_COLOR_IDS)[number];
    if (!nickname) return null;
    if (!AGE_BANDS.includes(ageBand)) return null;
    if (!MASCOT_COLOR_IDS.includes(mascotColor)) return null;
    validated.push({ nickname, ageBand, mascotColor });
  }
  return validated;
}

/** P2 Screen 1 — saves the parent's name and every child profile in one request, then marks onboarding complete. */
export async function createProfile(req: Request, res: Response) {
  const parentName = typeof req.body?.parentName === "string" ? req.body.parentName.trim() : "";
  if (!parentName) {
    return res.status(400).json({ error: "parentName is required" });
  }

  const children = validateChildren(req.body?.children);
  if (!children) {
    return res.status(400).json({
      error: `children must be an array of 1-${MAX_CHILDREN} entries, each with a non-empty nickname, a valid ageBand, and a valid mascotColor`,
    });
  }

  const uid = req.identity!.uid;
  const createdChildren = await createChildren(uid, children);
  await completeOnboarding(uid, parentName);

  return res.status(201).json({ children: createdChildren });
}

export async function getChildren(req: Request, res: Response) {
  const children = await listChildren(req.identity!.uid);
  return res.json({ children });
}
