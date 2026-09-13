// Versioned scoring and ranking configuration. Changing weights creates a new version and
// flips `active` in one transaction, so every stored score says which version produced it.
import type { Db } from "../db/pool";
import type { RankingConfig } from "../domain/recommendation";
import type { ScoringConfig } from "../domain/scoring";

function nextVersion(version: string): string {
  const match = version.match(/^(.*_V)(\d+)$/);
  return match ? `${match[1]}${Number(match[2]) + 1}` : `${version}_V2`;
}

export async function getActiveScoringConfig(db: Db): Promise<ScoringConfig> {
  const row = (await db.query("SELECT version, weights, source_reliability, min_ai_confidence FROM scoring_configs WHERE active")).rows[0];
  if (!row) throw new Error("No active scoring config; run migrations.");
  return {
    version: row.version,
    weights: row.weights,
    sourceReliability: row.source_reliability,
    minAiConfidence: Number(row.min_ai_confidence),
  };
}

export async function saveScoringConfig(
  db: Db,
  input: Omit<ScoringConfig, "version">,
  createdBy: string,
): Promise<ScoringConfig> {
  const version = nextVersion((await getActiveScoringConfig(db)).version);
  await db.query("UPDATE scoring_configs SET active = false WHERE active");
  await db.query(
    `INSERT INTO scoring_configs (version, weights, source_reliability, min_ai_confidence, active, created_by)
     VALUES ($1, $2, $3, $4, true, $5)`,
    [version, JSON.stringify(input.weights), JSON.stringify(input.sourceReliability), input.minAiConfidence, createdBy],
  );
  return { version, ...input };
}

interface RankingRow {
  version: string;
  weights: RankingConfig["weights"];
  params: {
    relevance_weights: { interests: number; development_goals: number; regulation_goals: number; category: number };
    max_per_creator_in_top: number;
    top_window: number;
    dismiss_cooldown_days: number;
    expert_neutral: number;
  };
}

function toRankingConfig(row: RankingRow): RankingConfig {
  const params = row.params;
  return {
    version: row.version,
    weights: row.weights,
    params: {
      relevanceWeights: {
        interests: params.relevance_weights.interests,
        developmentGoals: params.relevance_weights.development_goals,
        regulationGoals: params.relevance_weights.regulation_goals,
        category: params.relevance_weights.category,
      },
      maxPerCreatorInTop: params.max_per_creator_in_top,
      topWindow: params.top_window,
      dismissCooldownDays: params.dismiss_cooldown_days,
      expertNeutral: params.expert_neutral,
    },
  };
}

export async function getActiveRankingConfig(db: Db): Promise<RankingConfig> {
  const row = (await db.query<RankingRow>("SELECT version, weights, params FROM ranking_configs WHERE active")).rows[0];
  if (!row) throw new Error("No active ranking config; run migrations.");
  return toRankingConfig(row);
}

export async function saveRankingConfig(db: Db, input: Omit<RankingConfig, "version">, createdBy: string): Promise<RankingConfig> {
  const version = nextVersion((await getActiveRankingConfig(db)).version);
  const params = {
    relevance_weights: {
      interests: input.params.relevanceWeights.interests,
      development_goals: input.params.relevanceWeights.developmentGoals,
      regulation_goals: input.params.relevanceWeights.regulationGoals,
      category: input.params.relevanceWeights.category,
    },
    max_per_creator_in_top: input.params.maxPerCreatorInTop,
    top_window: input.params.topWindow,
    dismiss_cooldown_days: input.params.dismissCooldownDays,
    expert_neutral: input.params.expertNeutral,
  };
  await db.query("UPDATE ranking_configs SET active = false WHERE active");
  await db.query("INSERT INTO ranking_configs (version, weights, params, active, created_by) VALUES ($1, $2, $3, true, $4)", [
    version,
    JSON.stringify(input.weights),
    JSON.stringify(params),
    createdBy,
  ]);
  return { version, ...input };
}
