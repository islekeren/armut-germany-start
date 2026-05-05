import { describe, expect, it } from "vitest";
import {
  getBranchById,
  getBranchLabel,
  getBranchesByCategorySlug,
  getFallbackBranchByCategorySlug,
  getSectorById,
  getSectorLabel,
  resolveRequestTaxonomy,
} from "./request-taxonomy";

describe("request taxonomy helpers", () => {
  it("resolves a unique branch fallback from the category slug", () => {
    const branch = getFallbackBranchByCategorySlug("home-cleaning");

    expect(branch?.id).toBe("home-cleaning");
    expect(getBranchesByCategorySlug("home-cleaning")).toHaveLength(1);
    expect(getFallbackBranchByCategorySlug("missing-category")).toBeNull();
  });

  it("returns localized sector and branch labels", () => {
    const sector = getSectorById("cleaning-care");
    const branch = getBranchById("home-cleaning");

    expect(getSectorLabel(sector!, "de")).toBe("Reinigung & Haushaltspflege");
    expect(getBranchLabel(branch!, "en")).toBe("Home Cleaning");
  });

  it("fills in request taxonomy data from the category fallback", () => {
    expect(
      resolveRequestTaxonomy({
        categorySlug: "home-cleaning",
      }),
    ).toEqual({
      sectorId: "cleaning-care",
      sectorNameEn: "Cleaning & Home Care",
      sectorNameDe: "Reinigung & Haushaltspflege",
      branchId: "home-cleaning",
      branchNameEn: "Home Cleaning",
      branchNameDe: "Hausreinigung",
    });
  });
});
