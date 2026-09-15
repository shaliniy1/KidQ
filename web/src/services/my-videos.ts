import { api, unwrap } from "@/lib/api";
import type { paths } from "@/lib/api-types";

export type LibraryEntry = paths["/children/{id}/library"]["get"]["responses"][200]["content"]["application/json"]["items"][number];
export type SubmissionPreview = paths["/children/{id}/submissions/preview"]["post"]["responses"][200]["content"]["application/json"];
export type Submission = paths["/children/{id}/submissions"]["post"]["responses"][202]["content"]["application/json"];

/** Add a Video, step 1 — fetches KidQ's check for a URL. Saves nothing. */
export async function previewVideo(childId: string, url: string): Promise<SubmissionPreview> {
  return unwrap(await api.POST("/children/{id}/submissions/preview", { params: { path: { id: childId } }, body: { url } }));
}

/** Submits the URL for real: KidQ scores it with AI and an admin reviews it before it's playable. */
export async function submitVideo(childId: string, url: string): Promise<Submission> {
  return unwrap(await api.POST("/children/{id}/submissions", { params: { path: { id: childId } }, body: { url } }));
}

export async function listSubmissions(childId: string): Promise<Submission[]> {
  return unwrap(await api.GET("/children/{id}/submissions", { params: { path: { id: childId } } })).items;
}

export async function getLibrary(childId: string): Promise<LibraryEntry[]> {
  return unwrap(await api.GET("/children/{id}/library", { params: { path: { id: childId } } })).items;
}

export async function removeFromLibrary(childId: string, contentItemId: string): Promise<void> {
  await unwrap(
    await api.DELETE("/children/{id}/library/{contentItemId}", { params: { path: { id: childId, contentItemId } } }),
  );
}

// NOTE: there is no real per-child "exclude from just this child while keeping it in the family
// library" concept on the API today — the library already is per-child. INTEGRATION_NOTES.md's
// simulateAdminDecision (a fake Admin-approval callback) is intentionally not carried over here:
// approval only ever comes from the real admin app.
