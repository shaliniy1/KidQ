import express from "express";
import cors from "cors";
import { env } from "./config/env";
import healthRoutes from "./routes/health.routes";
import contentRoutes from "./routes/content.routes";
import parentConfigRoutes from "./routes/parent-config.routes";
import authRoutes from "./routes/auth.routes";
import consentRoutes from "./routes/consent.routes";
import onboardingRoutes from "./routes/onboarding.routes";
import curationSettingsRoutes from "./routes/curation-settings.routes";
import curationNluRoutes from "./routes/curation-nlu.routes";
import sessionRoutes from "./routes/session.routes";
import recommendationsRoutes from "./routes/recommendations.routes";
import sessionLogRoutes from "./routes/session-log.routes";
import inboxRoutes from "./routes/inbox.routes";

const app = express();

app.use(cors());
app.use(express.json());
app.use(healthRoutes);
app.use(contentRoutes);
app.use(parentConfigRoutes);
app.use(authRoutes);
app.use(consentRoutes);
app.use(onboardingRoutes);
app.use(curationSettingsRoutes);
app.use(curationNluRoutes);
app.use(sessionRoutes);
app.use(recommendationsRoutes);
app.use(sessionLogRoutes);
app.use(inboxRoutes);

app.listen(env.port, () => {
  console.log(`kidq-api listening on port ${env.port}`);
});
