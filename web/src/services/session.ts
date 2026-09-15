import { api, unwrap } from "@/lib/api";
import type { paths } from "@/lib/api-types";

export type AssembledSession = paths["/children/{id}/sessions"]["post"]["responses"][201]["content"]["application/json"];
export type SessionMode = NonNullable<NonNullable<paths["/children/{id}/sessions"]["post"]["requestBody"]>["content"]["application/json"]["mode"]>;

export async function startSession(childId: string, minutes: number, mode?: SessionMode): Promise<AssembledSession> {
  return unwrap(await api.POST("/children/{id}/sessions", { params: { path: { id: childId } }, body: { minutes, mode } }));
}

export async function getCurrentSession(childId: string): Promise<AssembledSession | null> {
  return unwrap(await api.GET("/children/{id}/sessions/current", { params: { path: { id: childId } } })).session;
}

export async function replaySession(sessionId: string): Promise<AssembledSession> {
  return unwrap(await api.POST("/sessions/{id}/replay", { params: { path: { id: sessionId } } }));
}

export async function recordItemOutcome(
  sessionId: string,
  itemId: string,
  update: { outcome?: "COMPLETED" | "SKIPPED" | "EXITED"; watched_seconds?: number; position_seconds?: number },
): Promise<AssembledSession> {
  return unwrap(
    await api.PATCH("/sessions/{id}/items/{itemId}", { params: { path: { id: sessionId, itemId } }, body: update }),
  );
}

export async function endSession(sessionId: string, outcome: "COMPLETED" | "EXITED"): Promise<AssembledSession> {
  return unwrap(await api.POST("/sessions/{id}/end", { params: { path: { id: sessionId } }, body: { outcome } }));
}

export async function listSessions(childId: string): Promise<AssembledSession[]> {
  return unwrap(await api.GET("/children/{id}/sessions", { params: { path: { id: childId } } })).items;
}
