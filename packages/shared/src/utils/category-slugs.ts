export const LEGACY_CATEGORY_SLUGS: Record<string, string> = {
  cleaning: "home-cleaning",
  tutoring: "math",
  photography: "event-photo",
  garden: "garden-maintenance",
  computerHelp: "computer",
  petCare: "pet-sitter",
};

export function getCanonicalCategorySlug(slug?: string | null): string | null {
  if (!slug) return null;
  return LEGACY_CATEGORY_SLUGS[slug] || slug;
}

export function isLegacyCategorySlug(slug?: string | null): boolean {
  if (!slug) return false;
  return slug in LEGACY_CATEGORY_SLUGS;
}
