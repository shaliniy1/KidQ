// Parent app API: onboarding (child profiles), recommendations, the parent-approved library and
// URL submissions. Scoped to the signed-in parent; only admin-approved content is ever playable.
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
  recommendationSchema,
  recommendationsQuery,
  submissionBody,
  submissionSchema,
} from "../http/schemas";
import * as parents from "../services/parents";

export const parentRouter = Router();
const roles: Array<"parent" | "admin"> = ["parent", "admin"];

defineRoute(
  parentRouter,
  { method: "get", path: "/children", summary: "The signed-in parent's children", tag: "Children", roles, response: z.object({ items: z.array(childSchema) }) },
  async ({ user }) => parents.listChildren(user),
);

defineRoute(
  parentRouter,
  { method: "post", path: "/children", summary: "Create a child profile (onboarding). Use keys from GET /taxonomy.", tag: "Children", roles, body: childBody, response: childSchema, status: 201 },
  async ({ user, body }) => parents.createChild(user, body),
);

defineRoute(
  parentRouter,
  { method: "get", path: "/children/:id", summary: "One child profile", tag: "Children", roles, params: childParams, response: childSchema },
  async ({ user, params }) => parents.getChild(user, params.id),
);

defineRoute(
  parentRouter,
  { method: "patch", path: "/children/:id", summary: "Update onboarding preferences", tag: "Children", roles, params: childParams, body: childPatchBody, response: childSchema },
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
