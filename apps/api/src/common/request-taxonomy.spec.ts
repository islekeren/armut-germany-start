import {
  getRequestBranchById,
  getRequestBranchesByCategorySlug,
  getRequestSectorById,
  getRequestTaxonomyCategoryBySlug,
  resolveRequestTaxonomy,
} from "./request-taxonomy";

describe("request taxonomy helpers", () => {
  it("looks up sectors, branches, and taxonomy categories by id/slug", () => {
    expect(getRequestSectorById("cleaning-care")?.labelEn).toBe(
      "Cleaning & Home Care",
    );
    expect(getRequestBranchById("home-cleaning")?.categorySlug).toBe(
      "home-cleaning",
    );
    expect(getRequestTaxonomyCategoryBySlug("cleaning-care")).toMatchObject({
      kind: "sector",
      id: "cleaning-care",
    });
    expect(getRequestTaxonomyCategoryBySlug("home-cleaning")).toMatchObject({
      kind: "branch",
      id: "home-cleaning",
      parentId: "cleaning-care",
    });
  });

  it("returns fallback taxonomy values when a category only maps to one branch", () => {
    expect(getRequestBranchesByCategorySlug("home-cleaning")).toHaveLength(1);
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

  it("prefers explicit branch and sector ids when they are provided", () => {
    expect(
      resolveRequestTaxonomy({
        requestSector: "art-events",
        requestBranch: "event-photo",
        categorySlug: "home-cleaning",
      }),
    ).toEqual({
      sectorId: "art-events",
      sectorNameEn: "Art, Photo & Events",
      sectorNameDe: "Kunst, Foto & Events",
      branchId: "event-photo",
      branchNameEn: "Event Photographer",
      branchNameDe: "Eventfotograf",
    });
  });
});
