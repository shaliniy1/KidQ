import { api, unwrap } from "@/lib/api";
import type { paths } from "@/lib/api-types";

export type ChildProfile = paths["/children"]["get"]["responses"][200]["content"]["application/json"]["items"][number];
export type OnboardingChild = NonNullable<paths["/onboarding"]["post"]["requestBody"]>["content"]["application/json"]["children"][number];
export type ChildPatch = NonNullable<paths["/children/{id}"]["patch"]["requestBody"]>["content"]["application/json"];
export type Me = paths["/me"]["get"]["responses"][200]["content"]["application/json"];

export async function submitOnboarding(
  parentName: string,
  children: OnboardingChild[],
  language = "en",
): Promise<Me> {
  return unwrap(await api.POST("/onboarding", { body: { parent_name: parentName, language, children } }));
}

export async function getMe(): Promise<Me> {
  return unwrap(await api.GET("/me"));
}

export async function getChildren(): Promise<ChildProfile[]> {
  return unwrap(await api.GET("/children")).items;
}

export async function createChild(child: OnboardingChild): Promise<ChildProfile> {
  return unwrap(await api.POST("/children", { body: child }));
}

export async function updateChild(childId: string, patch: ChildPatch): Promise<ChildProfile> {
  return unwrap(await api.PATCH("/children/{id}", { params: { path: { id: childId } }, body: patch }));
}
