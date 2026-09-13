-- Expert reviews are out of KidQ (decided with Shalini, 2026-09-13): parents see no expert line and
-- ranking has no expert signal. A new ranking version spreads the expert weight over the rest.
INSERT INTO ranking_configs (version, weights, params, active, created_by)
SELECT 'RANK_V' || (SELECT max(substring(version FROM '_V([0-9]+)$')::int) + 1 FROM ranking_configs),
       '{"relevance": 0.45, "score": 0.30, "learning": 0.15, "preference": 0.10}', params - 'expert_neutral', false, 'migration 008'
FROM ranking_configs WHERE active;
UPDATE ranking_configs SET active = false WHERE active;
UPDATE ranking_configs SET active = true WHERE created_by = 'migration 008';

DROP TABLE IF EXISTS expert_reviews;
