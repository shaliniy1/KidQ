import { apiFetch } from "./api";
import type { AgeBandDefaultsResponse, CategoriesResponse } from "@/types/parent-config";

/**
 * The category list and age-band defaults are backend-owned config, not
 * client constants (spec Section 9/12 Table B #4, grill decision "backend
 * config = source of truth"). No screen should hardcode a category list or
 * a development-goal mapping — fetch it from here instead.
 */
export async function getCategories(): Promise<CategoriesResponse> {
  return apiFetch<CategoriesResponse>("/config/categories");
}

export async function getAgeBandDefaults(): Promise<AgeBandDefaultsResponse> {
  return apiFetch<AgeBandDefaultsResponse>("/config/age-band-defaults");
}
