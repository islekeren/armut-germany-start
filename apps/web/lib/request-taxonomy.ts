import type { Category } from "@/lib/api";
import {
  getRequestBranchById,
  getRequestBranchesByCategorySlug,
  getRequestSectorById,
  getRequestTaxonomyCategoryBySlug,
  resolveRequestTaxonomy,
  type RequestBranchDefinition,
  type RequestSectorDefinition,
  REQUEST_BRANCHES as SHARED_REQUEST_BRANCHES,
  REQUEST_SECTORS as SHARED_REQUEST_SECTORS,
} from "../../api/src/common/request-taxonomy";

export type RequestSector = RequestSectorDefinition;
export type RequestBranch = RequestBranchDefinition;

export const REQUEST_SECTORS: RequestSector[] = SHARED_REQUEST_SECTORS;
export const REQUEST_BRANCHES: RequestBranch[] = SHARED_REQUEST_BRANCHES;

export function getCategoryDisplayName(category: Category, locale?: string) {
  return locale?.startsWith("de") ? category.nameDe : category.nameEn;
}

export function getSectorById(sectorId?: string | null) {
  return getRequestSectorById(sectorId);
}

export function getBranchById(branchId?: string | null) {
  return getRequestBranchById(branchId);
}

export function getBranchesByCategorySlug(categorySlug?: string | null) {
  return getRequestBranchesByCategorySlug(categorySlug);
}

export function getFallbackBranchByCategorySlug(categorySlug?: string | null) {
  const matches = getBranchesByCategorySlug(categorySlug);
  return matches.length === 1 ? matches[0] : null;
}

export { getRequestTaxonomyCategoryBySlug, resolveRequestTaxonomy };

export function getSectorLabel(sector: RequestSector, locale?: string) {
  return locale?.startsWith("de") ? sector.labelDe : sector.labelEn;
}

export function getBranchLabel(branch: RequestBranch, locale?: string) {
  return locale?.startsWith("de") ? branch.labelDe : branch.labelEn;
}
