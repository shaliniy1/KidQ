// One controlled vocabulary for admin tagging, AI suggestions and parent onboarding.
import type { Db } from "../db/pool";

export const TAXONOMY_KINDS = ["category", "interest", "development_goal", "regulation_goal", "language", "age_group"] as const;
export type TaxonomyKind = (typeof TAXONOMY_KINDS)[number];

export interface TaxonomyTerm {
  kind: TaxonomyKind;
  key: string;
  label: string;
  sortOrder: number;
  active: boolean;
  meta: Record<string, unknown>;
}

export type Taxonomy = Record<TaxonomyKind, TaxonomyTerm[]>;

export async function listTaxonomy(db: Db, options: { includeInactive?: boolean } = {}): Promise<Taxonomy> {
  const { rows } = await db.query(
    `SELECT kind, key, label, sort_order, active, meta FROM taxonomy_terms
     ${options.includeInactive ? "" : "WHERE active"} ORDER BY kind, sort_order, label`,
  );
  const taxonomy = Object.fromEntries(TAXONOMY_KINDS.map((kind) => [kind, [] as TaxonomyTerm[]])) as Taxonomy;
  for (const row of rows) {
    taxonomy[row.kind as TaxonomyKind].push({
      kind: row.kind,
      key: row.key,
      label: row.label,
      sortOrder: row.sort_order,
      active: row.active,
      meta: row.meta,
    });
  }
  return taxonomy;
}

export function keysOf(taxonomy: Taxonomy, kind: TaxonomyKind): string[] {
  return taxonomy[kind].filter((term) => term.active).map((term) => term.key);
}

export async function upsertTaxonomyTerm(
  db: Db,
  term: { kind: TaxonomyKind; key: string; label: string; sortOrder?: number; active?: boolean; meta?: Record<string, unknown> },
): Promise<void> {
  await db.query(
    `INSERT INTO taxonomy_terms (kind, key, label, sort_order, active, meta) VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (kind, key) DO UPDATE SET label = EXCLUDED.label, sort_order = EXCLUDED.sort_order,
       active = EXCLUDED.active, meta = EXCLUDED.meta`,
    [term.kind, term.key, term.label, term.sortOrder ?? 100, term.active ?? true, JSON.stringify(term.meta ?? {})],
  );
}
