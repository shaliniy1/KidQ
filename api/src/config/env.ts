import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const flag = (fallback: "true" | "false") =>
  z.enum(["true", "false"]).default(fallback).transform((value) => value === "true");

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().default("postgresql://localhost:5432/kidq"),
  DATABASE_SSL: z.enum(["disable", "require", "verify-full"]).default("disable"),
  DATABASE_CA_CERT: z.string().optional(),
  DB_POOL_MAX: z.coerce.number().int().positive().default(10),
  RUN_MIGRATIONS_ON_BOOT: flag("false"),
  RUN_WORKER_IN_PROCESS: flag("true"),
  AUTH_MODE: z.enum(["supabase", "dev"]).default("supabase"),
  SUPABASE_URL: z.string().optional(),
  SUPABASE_JWT_SECRET: z.string().optional(),
  CORS_ORIGINS: z.string().default("http://localhost:3000,http://localhost:3001"),
  HTTP_USER_AGENT: z.string().default("KidQ-content-ingestion/1.0 (+https://github.com/shaliniy1/KidQ)"),
  YOUTUBE_DATA_API_KEY: z.string().optional(),
  GEMINI_API_KEY: z.string().optional(),
  AI_SCORING_MODEL: z.string().default("gemini-3.8-flash"),
  AI_ESCALATION_MODEL: z.string().optional(),
  // Tried in order when the scoring model's free daily quota runs out or it's overloaded. Keep them in
  // one model family so scores stay comparable; list only the scoring model to turn fallbacks off.
  AI_FALLBACK_MODELS: z.string().default("gemini-3.7-flash,gemini-3.6-flash"),
  AI_DAILY_VIDEO_SECONDS_CAP: z.coerce.number().int().positive().default(27_000),
  // Free tier costs nothing; set paid-tier prices to record estimated spend per assessment.
  AI_INPUT_USD_PER_MTOK: z.coerce.number().min(0).default(0),
  AI_OUTPUT_USD_PER_MTOK: z.coerce.number().min(0).default(0),
  AI_MAX_MEDIA_BYTES: z.coerce.number().int().positive().default(100 * 1024 * 1024),
});

// Treat `KEY=` lines in .env files as unset so defaults apply.
const raw = Object.fromEntries(Object.entries(process.env).filter(([, value]) => value !== ""));
const parsed = schema.parse(raw);

if (parsed.AUTH_MODE === "dev" && parsed.NODE_ENV === "production") {
  throw new Error("AUTH_MODE=dev is not allowed when NODE_ENV=production.");
}

export const env = {
  nodeEnv: parsed.NODE_ENV,
  isProduction: parsed.NODE_ENV === "production",
  port: parsed.PORT,
  databaseUrl: parsed.DATABASE_URL,
  databaseSsl: parsed.DATABASE_SSL,
  databaseCaCert: parsed.DATABASE_CA_CERT,
  dbPoolMax: parsed.DB_POOL_MAX,
  runMigrationsOnBoot: parsed.RUN_MIGRATIONS_ON_BOOT,
  runWorkerInProcess: parsed.RUN_WORKER_IN_PROCESS,
  authMode: parsed.AUTH_MODE,
  supabaseUrl: parsed.SUPABASE_URL,
  supabaseJwtSecret: parsed.SUPABASE_JWT_SECRET,
  corsOrigins: parsed.CORS_ORIGINS.split(",").map((origin) => origin.trim()).filter(Boolean),
  httpUserAgent: parsed.HTTP_USER_AGENT,
  youtubeApiKey: parsed.YOUTUBE_DATA_API_KEY,
  geminiApiKey: parsed.GEMINI_API_KEY,
  aiScoringModel: parsed.AI_SCORING_MODEL,
  aiEscalationModel: parsed.AI_ESCALATION_MODEL ?? null,
  aiFallbackModels: parsed.AI_FALLBACK_MODELS.split(",")
    .map((model) => model.trim())
    .filter(Boolean),
  aiDailyVideoSecondsCap: parsed.AI_DAILY_VIDEO_SECONDS_CAP,
  aiInputUsdPerMTok: parsed.AI_INPUT_USD_PER_MTOK,
  aiOutputUsdPerMTok: parsed.AI_OUTPUT_USD_PER_MTOK,
  aiMaxMediaBytes: parsed.AI_MAX_MEDIA_BYTES,
};
