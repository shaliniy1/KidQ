import { Router } from "express";
import { z } from "zod";
import { getPool } from "../db/pool";
import { ApiError } from "../http/errors";
import { defineRoute } from "../http/route";
import { taxonomySchema } from "../http/schemas";
import { listTaxonomy } from "../repositories/taxonomy";

export const publicRouter = Router();

defineRoute(
  publicRouter,
  {
    method: "get",
    path: "/ready",
    summary: "Readiness check: database reachable and migrated (Render health check)",
    tag: "System",
    response: z.object({ status: z.literal("ready"), migrations: z.array(z.string()) }),
  },
  async () => {
    try {
      const { rows } = await getPool().query<{ version: string }>("SELECT version FROM schema_migrations ORDER BY version");
      return { status: "ready" as const, migrations: rows.map((row) => row.version) };
    } catch {
      throw new ApiError(503, "NOT_READY", "Database is unavailable.");
    }
  },
);

defineRoute(
  publicRouter,
  {
    method: "get",
    path: "/taxonomy",
    summary: "Shared vocabulary: categories, interests, goals, languages and age groups (use these keys in onboarding and tagging)",
    tag: "Taxonomy",
    query: z.object({ include_inactive: z.enum(["true", "false"]).optional() }),
    response: taxonomySchema,
    cache: "public, max-age=300",
  },
  async ({ query, req }) => listTaxonomy(getPool(), { includeInactive: query.include_inactive === "true" && req.user?.role === "admin" }),
);
