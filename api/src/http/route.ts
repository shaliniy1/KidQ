// Every route is declared once: request validation, role check and OpenAPI documentation come
// from the same zod schemas, so the published contract can't drift from the code.
import { extendZodWithOpenApi, OpenAPIRegistry, OpenApiGeneratorV31 } from "@asteasolutions/zod-to-openapi";
import type { Request, Response, Router } from "express";
import { z, type ZodObject, type ZodType } from "zod";
import { requireRole, type AuthUser, type Role } from "./auth";
import { asyncHandler } from "./errors";

// Adds .openapi() to zod schemas; must run before any schema is registered by name.
extendZodWithOpenApi(z);

export const registry = new OpenAPIRegistry();
registry.registerComponent("securitySchemes", "bearerAuth", { type: "http", scheme: "bearer", bearerFormat: "JWT" });

const errorSchema = registry.register(
  "Error",
  z.object({ error: z.object({ code: z.string(), message: z.string(), details: z.unknown().nullable() }) }),
);

type Method = "get" | "post" | "put" | "patch" | "delete";

interface RouteSpec<P extends ZodObject, Q extends ZodObject, B extends ZodType> {
  method: Method;
  path: string;
  summary: string;
  tag: string;
  roles?: Role[];
  params?: P;
  query?: Q;
  body?: B;
  response: ZodType;
  status?: number;
  /** Cache-Control for GETs the PWA may cache; everything else is no-store. */
  cache?: string;
}

interface Context<P extends ZodObject, Q extends ZodObject, B extends ZodType> {
  params: z.infer<P>;
  query: z.infer<Q>;
  body: z.infer<B>;
  user: AuthUser;
  req: Request;
  res: Response;
}

const toOpenApiPath = (path: string) => path.replace(/:([A-Za-z_]+)/g, "{$1}");

export function defineRoute<P extends ZodObject = ZodObject, Q extends ZodObject = ZodObject, B extends ZodType = ZodType>(
  router: Router,
  spec: RouteSpec<P, Q, B>,
  handler: (context: Context<P, Q, B>) => Promise<unknown>,
) {
  const status = spec.status ?? 200;
  registry.registerPath({
    method: spec.method,
    path: toOpenApiPath(spec.path),
    summary: spec.summary,
    tags: [spec.tag],
    security: spec.roles ? [{ bearerAuth: [] }] : [],
    request: {
      params: spec.params,
      query: spec.query,
      body: spec.body ? { content: { "application/json": { schema: spec.body } } } : undefined,
    },
    responses: {
      [status]: { description: "Success", content: { "application/json": { schema: spec.response } } },
      400: { description: "Validation failed", content: { "application/json": { schema: errorSchema } } },
      ...(spec.roles
        ? {
            401: { description: "Not signed in", content: { "application/json": { schema: errorSchema } } },
            403: { description: "Wrong role", content: { "application/json": { schema: errorSchema } } },
          }
        : {}),
      404: { description: "Not found", content: { "application/json": { schema: errorSchema } } },
    },
  });

  const guards = spec.roles ? [requireRole(...spec.roles)] : [];
  router[spec.method](
    spec.path,
    ...guards,
    asyncHandler(async (req, res) => {
      const context = {
        params: (spec.params ? spec.params.parse(req.params) : {}) as z.infer<P>,
        query: (spec.query ? spec.query.parse(req.query) : {}) as z.infer<Q>,
        body: (spec.body ? spec.body.parse(req.body) : undefined) as z.infer<B>,
        user: req.user as AuthUser,
        req,
        res,
      };
      const result = await handler(context);
      if (res.headersSent) return;
      res.setHeader("Cache-Control", spec.method === "get" && spec.cache ? spec.cache : "no-store");
      res.status(status).json(result);
    }),
  );
}

export function buildOpenApiDocument(serverUrl?: string) {
  return new OpenApiGeneratorV31(registry.definitions).generateDocument({
    openapi: "3.1.0",
    info: {
      title: "KidQ API",
      version: "1.0.0",
      description:
        "Content curation, KidQ content score, admin publishing and recommendations. Spec: docs/recommendation/README.md and docs/content-curation/README.md.",
    },
    servers: serverUrl ? [{ url: serverUrl }] : [],
  });
}
