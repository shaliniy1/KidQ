import cors from "cors";
import express from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import swaggerUi from "swagger-ui-express";
import { env } from "./config/env";
import { authenticate } from "./http/auth";
import { ApiError, errorHandler } from "./http/errors";
import { buildOpenApiDocument } from "./http/route";
import { adminRouter } from "./routes/admin";
import healthRoutes from "./routes/health.routes";
import { parentRouter } from "./routes/parent";
import { publicRouter } from "./routes/public";

export function createApp() {
  const app = express();
  app.set("trust proxy", 1); // Render terminates TLS at its proxy.
  app.disable("x-powered-by");
  // KidQ query strings are flat key/value pairs; Node's parser avoids qs's nested-object parsing
  // (and its open DoS advisories) for attacker-controlled input.
  app.set("query parser", "simple");
  // JSON API: the CSP header would only get in the way of the Swagger UI at /docs.
  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(
    cors({
      // Bearer tokens, no cookies: only listed UI origins (web, admin, TV wrappers) may call from a browser.
      origin: (origin, callback) => callback(null, !origin || env.corsOrigins.includes("*") || env.corsOrigins.includes(origin)),
      maxAge: 600,
    }),
  );
  app.use(express.json({ limit: "256kb" }));
  app.use(
    rateLimit({
      windowMs: 60_000,
      limit: env.isProduction ? 120 : 10_000,
      standardHeaders: "draft-8",
      legacyHeaders: false,
      skip: (req) => req.method === "GET",
    }),
  );
  app.use(authenticate);

  app.use(healthRoutes);
  app.use(publicRouter);
  app.use(adminRouter);
  app.use(parentRouter);

  const document = buildOpenApiDocument();
  app.get("/openapi.json", (_req, res) => {
    res.json(document);
  });
  app.use("/docs", swaggerUi.serve, swaggerUi.setup(document));

  app.use((_req, _res, next) => next(new ApiError(404, "NOT_FOUND", "No such endpoint.")));
  app.use(errorHandler);
  return app;
}
