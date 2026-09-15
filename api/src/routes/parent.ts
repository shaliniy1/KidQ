// Parent app API: onboarding (parent and child profiles), recommendations, the parent-approved
// library and URL submissions. Scoped to the signed-in parent; only admin-approved content is ever
// playable. Onboarding fields: docs/recommendation/parent-onboarding.md.
import { Router } from "express";
import { z } from "zod";
import { defineRoute } from "../http/route";
import {
  childBody,
  childItemParams,
  childParams,
  childPatchBody,
  childSchema,
  libraryBody,
  libraryItemSchema,
  meSchema,
  mePatchBody,
  onboardingBody,
  recommendationSchema,
  recommendationsQuery,
  analyticsEventsBody,
  analyticsEventsResult,
  analyticsQuery,
  parentAnalyticsSchema,
  sessionEndBody,
  submissionPreviewBody,
  submissionPreviewSchema,
  sessionItemBody,
  sessionItemParams,
  sessionParams,
  sessionSchema,
  sessionStartBody,
  submissionBody,
  submissionSchema,
} from "../http/schemas";
import * as parents from "../services/parents";
import * as analytics from "../services/analytics";
import * as sessions from "../services/sessions";

export const parentRouter = Router();
const roles: Array<"parent" | "admin"> = ["parent", "admin"];

defineRoute(
  parentRouter,
  {
    method: "post",
    path: "/onboarding",
    summary: "Screen 1 in one call: the parent's name and language, and each child's nickname and age band (1–6); the rest starts from age-based defaults",
    tag: "Onboarding",
    roles,
    body: onboardingBody,
    response: meSchema,
    status: 201,
  },
  async ({ user, body }) => parents.onboard(user, body),
);

defineRoute(
  parentRouter,
  { method: "get", path: "/me", summary: "The parent's profile and children; 404 NOT_ONBOARDED means show onboarding", tag: "Onboarding", roles, response: meSchema },
  async ({ user }) => parents.getMe(user),
);

defineRoute(
  parentRouter,
  { method: "patch", path: "/me", summary: "Change the parent's name or language", tag: "Onboarding", roles, body: mePatchBody, response: meSchema },
  async ({ user, body }) => parents.updateMe(user, body),
);

defineRoute(
  parentRouter,
  { method: "get", path: "/children", summary: "The signed-in parent's children", tag: "Children", roles, response: z.object({ items: z.array(childSchema) }) },
  async ({ user }) => parents.listChildren(user),
);

defineRoute(
  parentRouter,
  { method: "post", path: "/children", summary: "Add a child: nickname and age band (up to 6 per family); keys from GET /taxonomy", tag: "Children", roles, body: childBody, response: childSchema, status: 201 },
  async ({ user, body }) => parents.createChild(user, body),
);

defineRoute(
  parentRouter,
  { method: "get", path: "/children/:id", summary: "One child profile", tag: "Children", roles, params: childParams, response: childSchema },
  async ({ user, params }) => parents.getChild(user, params.id),
);

defineRoute(
  parentRouter,
  {
    method: "patch",
    path: "/children/:id",
    summary: "Customize: interests, content mix, regulation goals, session length, breaks, languages or a new age band",
    tag: "Children",
    roles,
    params: childParams,
    body: childPatchBody,
    response: childSchema,
  },
  async ({ user, params, body }) => parents.updateChild(user, params.id, body),
);

defineRoute(
  parentRouter,
  {
    method: "get",
    path: "/children/:id/recommendations",
    summary: "Ranked, admin-approved recommendations with reasons and the content score",
    tag: "Recommendations",
    roles,
    params: childParams,
    query: recommendationsQuery,
    response: z.object({ items: z.array(recommendationSchema), limit: z.number(), offset: z.number(), ranking_version: z.string() }),
    cache: "private, max-age=60",
  },
  async ({ user, params, query }) => parents.recommendationsFor(user, params.id, query),
);

defineRoute(
  parentRouter,
  {
    method: "get",
    path: "/children/:id/library",
    summary: "Parent-approved library (only published items are playable; REQUESTED items await KidQ review)",
    tag: "Library",
    roles,
    params: childParams,
    response: z.object({ items: z.array(libraryItemSchema) }),
    cache: "private, max-age=30",
  },
  async ({ user, params }) => parents.getLibrary(user, params.id),
);

defineRoute(
  parentRouter,
  {
    method: "post",
    path: "/children/:id/library",
    summary: "Add (or dismiss with 'Not now') an item. Unapproved own submissions become REQUESTED.",
    tag: "Library",
    roles,
    params: childParams,
    body: libraryBody,
    response: z.object({ content_item_id: z.uuid(), state: z.string(), awaiting_review: z.boolean() }),
    status: 201,
  },
  async ({ user, params, body }) => parents.setLibraryState(user, params.id, body.content_item_id, body.state),
);

defineRoute(
  parentRouter,
  {
    method: "delete",
    path: "/children/:id/library/:contentItemId",
    summary: "Remove an item from the child's library",
    tag: "Library",
    roles,
    params: childItemParams,
    response: z.object({ content_item_id: z.uuid(), state: z.string() }),
  },
  async ({ user, params }) => parents.removeFromLibrary(user, params.id, params.contentItemId),
);

defineRoute(
  parentRouter,
  {
    method: "post",
    path: "/children/:id/submissions",
    summary: "Add a YouTube link; KidQ scores it with AI and an admin reviews it before the child can watch",
    tag: "Submissions",
    roles,
    params: childParams,
    body: submissionBody,
    response: submissionSchema,
    status: 202,
  },
  async ({ user, params, body }) => parents.submitUrl(user, params.id, body.url),
);

defineRoute(
  parentRouter,
  { method: "get", path: "/children/:id/submissions", summary: "This child's submitted links and their review status", tag: "Submissions", roles, params: childParams, response: z.object({ items: z.array(submissionSchema) }) },
  async ({ user, params }) => parents.listSubmissions(user, params.id),
);

defineRoute(
  parentRouter,
  {
    method: "post",
    path: "/children/:id/sessions",
    summary: "Start a Session: builds the slot-by-slot queue from the child's library for the chosen minutes and starts it at once",
    tag: "Sessions",
    roles,
    params: childParams,
    body: sessionStartBody,
    response: sessionSchema,
    status: 201,
  },
  async ({ user, params, body }) => sessions.startSession(user, params.id, body),
);

defineRoute(
  parentRouter,
  { method: "get", path: "/children/:id/sessions", summary: "The handoff log: this child's recent sessions, what was watched and how each ended", tag: "Sessions", roles, params: childParams, response: z.object({ items: z.array(sessionSchema) }) },
  async ({ user, params }) => sessions.listSessions(user, params.id),
);

defineRoute(
  parentRouter,
  { method: "patch", path: "/sessions/:id/items/:itemId", summary: "Record how one video went (COMPLETED, SKIPPED or EXITED) and where it stopped", tag: "Sessions", roles, params: sessionItemParams, body: sessionItemBody, response: sessionSchema },
  async ({ user, params, body }) => sessions.recordItemOutcome(user, params.id, params.itemId, body),
);

defineRoute(
  parentRouter,
  { method: "post", path: "/sessions/:id/end", summary: "End the session: COMPLETED after the wind-down, or EXITED early", tag: "Sessions", roles, params: sessionParams, body: sessionEndBody, response: sessionSchema },
  async ({ user, params, body }) => sessions.endSession(user, params.id, body.outcome),
);

defineRoute(
  parentRouter,
  {
    method: "post",
    path: "/children/:id/events",
    summary: "Record viewing events (up to 50 per batch); a resent event is not counted twice",
    tag: "Analytics",
    roles,
    params: childParams,
    body: analyticsEventsBody,
    response: analyticsEventsResult,
  },
  async ({ user, params, body }) => analytics.recordEvents(user, params.id, body.events),
);

defineRoute(
  parentRouter,
  {
    method: "get",
    path: "/children/:id/analytics",
    summary: "The Parent Analytics page: screen time, categories, most watched, completion and a few factual insights",
    tag: "Analytics",
    roles,
    params: childParams,
    query: analyticsQuery,
    response: parentAnalyticsSchema,
  },
  async ({ user, params, query }) => analytics.getAnalytics(user, params.id, query.period),
);

defineRoute(
  parentRouter,
  {
    method: "post",
    path: "/children/:id/submissions/preview",
    summary: "Add a Video, step 1: a YouTube link's details and KidQ check, before adding it. Saves nothing",
    tag: "Submissions",
    roles,
    params: childParams,
    body: submissionPreviewBody,
    response: submissionPreviewSchema,
  },
  async ({ user, params, body }) => parents.previewSubmission(user, params.id, body.url),
);

defineRoute(
  parentRouter,
  {
    method: "get",
    path: "/children/:id/sessions/current",
    summary: "Child mode opens on this: today's live session, or null when the sun is still asleep",
    tag: "Sessions",
    roles,
    params: childParams,
    response: z.object({ session: z.union([sessionSchema, z.null()]) }),
  },
  async ({ user, params }) => sessions.currentSession(user, params.id),
);

defineRoute(
  parentRouter,
  {
    method: "post",
    path: "/sessions/:id/replay",
    summary: "Play an earlier session again as a new one: same videos and order, minus any no longer in the library",
    tag: "Sessions",
    roles,
    params: sessionParams,
    response: sessionSchema,
    status: 201,
  },
  async ({ user, params }) => sessions.replaySession(user, params.id),
);
