"use client";

import { useEffect, useState } from "react";
import { api, unwrap } from "./api";

export interface Term {
  kind: string;
  key: string;
  label: string;
  meta: Record<string, unknown>;
}

export type Taxonomy = Record<"category" | "interest" | "development_goal" | "regulation_goal" | "language" | "age_group", Term[]>;

let cache: Promise<Taxonomy> | null = null;

/** The shared vocabulary (GET /taxonomy), fetched once per page load. */
export function useTaxonomy(): Taxonomy | null {
  const [taxonomy, setTaxonomy] = useState<Taxonomy | null>(null);
  useEffect(() => {
    cache ??= api.GET("/taxonomy").then((result) => unwrap(result) as unknown as Taxonomy);
    cache.then(setTaxonomy).catch(() => {
      cache = null;
    });
  }, []);
  return taxonomy;
}

export function labelFor(taxonomy: Taxonomy | null, kind: keyof Taxonomy, key: string): string {
  return taxonomy?.[kind].find((term) => term.key === key)?.label ?? key;
}

/** An age band's [min, max] from the taxonomy (the same bands parents pick in onboarding). */
export function ageRange(taxonomy: Taxonomy | null, key: string): [number, number] | null {
  const meta = taxonomy?.age_group.find((term) => term.key === key)?.meta;
  return meta && typeof meta.min === "number" && typeof meta.max === "number" ? [meta.min, meta.max] : null;
}
