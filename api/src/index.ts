import express from "express";
import cors from "cors";
import { env } from "./config/env";
import healthRoutes from "./routes/health.routes";
import contentRoutes from "./routes/content.routes";

const app = express();

app.use(cors());
app.use(express.json());
app.use(healthRoutes);
app.use(contentRoutes);

app.listen(env.port, () => {
  console.log(`kidq-api listening on port ${env.port}`);
});
