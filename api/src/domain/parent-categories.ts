// The seven parent categories (docs/recommendation/parent-experience.md, Block B). Each rolls up
// admin categories; the taxonomy (kind `parent_category`, `meta.includes`) is the one source of truth.
// Pure: no I/O.

export interface ParentCategory {
  key: string;
  label: string;
  /** The admin category keys it covers. */
  includes: string[];
}

interface TermLike {
  key: string;
  label: string;
  active: boolean;
  meta: Record<string, unknown>;
}

export function parentCategoriesFrom(terms: TermLike[]): ParentCategory[] {
  return terms
    .filter((term) => term.active)
    .map((term) => ({
      key: term.key,
      label: term.label,
      includes: Array.isArray(term.meta?.includes) ? (term.meta.includes as unknown[]).filter((key): key is string => typeof key === "string") : [],
    }));
}

/** The parent category an admin category belongs to, or null when none covers it. */
export function groupOf(groups: ParentCategory[], adminKey: string | null): string | null {
  if (!adminKey) return null;
  return groups.find((group) => group.includes.includes(adminKey))?.key ?? null;
}
