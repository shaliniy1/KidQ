import type { KidQUser } from "./auth";
import { apiFetch } from "./api";
import type { ChildProfile, CreateChildInput } from "@/types/child-profile";

async function authHeaders(user: KidQUser): Promise<HeadersInit> {
  return { Authorization: `Bearer ${await user.getIdToken()}`, "Content-Type": "application/json" };
}

export async function submitProfile(
  user: KidQUser,
  parentName: string,
  children: CreateChildInput[]
): Promise<ChildProfile[]> {
  const { children: created } = await apiFetch<{ children: ChildProfile[] }>("/onboarding/profile", {
    method: "POST",
    headers: await authHeaders(user),
    body: JSON.stringify({ parentName, children }),
  });
  return created;
}

export async function getChildren(user: KidQUser): Promise<ChildProfile[]> {
  const { children } = await apiFetch<{ children: ChildProfile[] }>("/children", {
    headers: await authHeaders(user),
  });
  return children;
}
