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
import consentRouter from "./routes/consent.routes";
import curationNluRouter from "./routes/curation-nlu.routes";
import curationSettingsRouter from "./routes/curation-settings.routes";
import excludeListRouter from "./routes/exclude-list.routes";
import feedbackRouter from "./routes/feedback.routes";
import inboxRouter from "./routes/inbox.routes";
import myVideosRouter from "./routes/my-videos.routes";
import onboardingRouter from "./routes/onboarding.routes";
import parentConfigRouter from "./routes/parent-config.routes";
import sessionLogRouter from "./routes/session-log.routes";
import sessionRouter from "./routes/session.routes";

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

  // Parent-screens features (vishnupriya/parent-screens) that don't overlap main's real routes.
  // Auth now runs through the shared Supabase-backed `authenticate`/`requireRole` above, not the
  // old Firebase middleware these were originally written against.
  app.use(consentRouter);
  app.use(curationNluRouter);
  app.use(curationSettingsRouter);
  app.use(excludeListRouter);
  app.use(feedbackRouter);
  app.use(inboxRouter);
  app.use(myVideosRouter);
  app.use(onboardingRouter); // only POST /onboarding/profile — its GET /children route was dropped above.
  app.use(parentConfigRouter);
  app.use(sessionLogRouter);
  app.use(sessionRouter);

  const document = buildOpenApiDocument();
  app.get("/openapi.json", (_req, res) => {
    res.json(document);
  });
  app.use("/docs", swaggerUi.serve, swaggerUi.setup(document));

  app.use((_req, _res, next) => next(new ApiError(404, "NOT_FOUND", "No such endpoint.")));
  app.use(errorHandler);
  return app;
}
