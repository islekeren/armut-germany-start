import { getCanonicalCategorySlug } from "@repo/shared";

type RequestSectorDefinition = {
  id: string;
  labelEn: string;
  labelDe: string;
};

type RequestBranchDefinition = {
  id: string;
  sectorId: string;
  labelEn: string;
  labelDe: string;
  categorySlug: string;
  icon: string;
};

export const REQUEST_SECTORS: RequestSectorDefinition[] = [
  {
    id: "home-repair",
    labelEn: "Home Repair & Renovation",
    labelDe: "Hausreparatur & Renovierung",
  },
  {
    id: "cleaning-care",
    labelEn: "Cleaning & Home Care",
    labelDe: "Reinigung & Haushaltspflege",
  },
  {
    id: "education-hobby",
    labelEn: "Education, Courses & Hobby",
    labelDe: "Bildung, Kurse & Hobby",
  },
  {
    id: "art-events",
    labelEn: "Art, Photo & Events",
    labelDe: "Kunst, Foto & Events",
  },
  {
    id: "health-beauty",
    labelEn: "Health & Beauty",
    labelDe: "Gesundheit & Beauty",
  },
  {
    id: "digital-tech",
    labelEn: "Digital & Technology",
    labelDe: "Digital & Technologie",
  },
  {
    id: "logistics",
    labelEn: "Transport & Logistics",
    labelDe: "Transport & Logistik",
  },
  {
    id: "pet-care",
    labelEn: "Pet Services",
    labelDe: "Haustierdienste",
  },
];

export const REQUEST_BRANCHES: RequestBranchDefinition[] = [
  {
    id: "electrician",
    sectorId: "home-repair",
    labelEn: "Electrician",
    labelDe: "Elektriker",
    categorySlug: "electrician",
    icon: "⚡",
  },
  {
    id: "plumber",
    sectorId: "home-repair",
    labelEn: "Plumber",
    labelDe: "Installateur",
    categorySlug: "plumber",
    icon: "🔧",
  },
  {
    id: "painter",
    sectorId: "home-repair",
    labelEn: "Painter",
    labelDe: "Maler",
    categorySlug: "painter",
    icon: "🎨",
  },
  {
    id: "locksmith",
    sectorId: "home-repair",
    labelEn: "Locksmith",
    labelDe: "Schluesseldienst",
    categorySlug: "locksmith",
    icon: "🔐",
  },
  {
    id: "renovation",
    sectorId: "home-repair",
    labelEn: "Renovation",
    labelDe: "Renovierung",
    categorySlug: "renovation",
    icon: "🔨",
  },
  {
    id: "home-cleaning",
    sectorId: "cleaning-care",
    labelEn: "Home Cleaning",
    labelDe: "Hausreinigung",
    categorySlug: "home-cleaning",
    icon: "🧹",
  },
  {
    id: "office-cleaning",
    sectorId: "cleaning-care",
    labelEn: "Office Cleaning",
    labelDe: "Bueroreinigung",
    categorySlug: "office-cleaning",
    icon: "🧼",
  },
  {
    id: "deep-cleaning",
    sectorId: "cleaning-care",
    labelEn: "Deep Cleaning",
    labelDe: "Grundreinigung",
    categorySlug: "deep-cleaning",
    icon: "✨",
  },
  {
    id: "garden-maintenance",
    sectorId: "cleaning-care",
    labelEn: "Garden Maintenance",
    labelDe: "Gartenpflege",
    categorySlug: "garden-maintenance",
    icon: "🌳",
  },
  {
    id: "math",
    sectorId: "education-hobby",
    labelEn: "Math Lessons",
    labelDe: "Matheunterricht",
    categorySlug: "math",
    icon: "📚",
  },
  {
    id: "english",
    sectorId: "education-hobby",
    labelEn: "English Lessons",
    labelDe: "Englischunterricht",
    categorySlug: "english",
    icon: "🗣️",
  },
  {
    id: "music",
    sectorId: "education-hobby",
    labelEn: "Music Lessons",
    labelDe: "Musikunterricht",
    categorySlug: "music",
    icon: "🎵",
  },
  {
    id: "wedding-photo",
    sectorId: "art-events",
    labelEn: "Wedding Photographer",
    labelDe: "Hochzeitsfotograf",
    categorySlug: "wedding-photo",
    icon: "📸",
  },
  {
    id: "event-photo",
    sectorId: "art-events",
    labelEn: "Event Photographer",
    labelDe: "Eventfotograf",
    categorySlug: "event-photo",
    icon: "📷",
  },
  {
    id: "video",
    sectorId: "art-events",
    labelEn: "Video Shooting",
    labelDe: "Videoaufnahme",
    categorySlug: "video",
    icon: "🎬",
  },
  {
    id: "beauty",
    sectorId: "health-beauty",
    labelEn: "Beauty Service",
    labelDe: "Beautydienst",
    categorySlug: "beauty",
    icon: "💄",
  },
  {
    id: "hair",
    sectorId: "health-beauty",
    labelEn: "Hairdresser (Home Visit)",
    labelDe: "Friseur (Hausbesuch)",
    categorySlug: "hair",
    icon: "💇",
  },
  {
    id: "computer",
    sectorId: "digital-tech",
    labelEn: "Computer Help",
    labelDe: "Computerhilfe",
    categorySlug: "computer",
    icon: "💻",
  },
  {
    id: "software",
    sectorId: "digital-tech",
    labelEn: "Software & IT Support",
    labelDe: "Software & IT Support",
    categorySlug: "software",
    icon: "🖥️",
  },
  {
    id: "website",
    sectorId: "digital-tech",
    labelEn: "Website Development",
    labelDe: "Webentwicklung",
    categorySlug: "website",
    icon: "🌐",
  },
  {
    id: "moving",
    sectorId: "logistics",
    labelEn: "Home Moving",
    labelDe: "Umzug",
    categorySlug: "moving",
    icon: "📦",
  },
  {
    id: "furniture",
    sectorId: "logistics",
    labelEn: "Furniture Assembly",
    labelDe: "Moebelmontage",
    categorySlug: "furniture",
    icon: "🪑",
  },
  {
    id: "storage",
    sectorId: "logistics",
    labelEn: "Storage & Mini Warehouse",
    labelDe: "Lagerung",
    categorySlug: "storage",
    icon: "🏷️",
  },
  {
    id: "pet-sitter",
    sectorId: "pet-care",
    labelEn: "Pet Sitting",
    labelDe: "Tiersitting",
    categorySlug: "pet-sitter",
    icon: "🐾",
  },
  {
    id: "dog-walk",
    sectorId: "pet-care",
    labelEn: "Dog Walking",
    labelDe: "Hundeservice",
    categorySlug: "dog-walk",
    icon: "🦮",
  },
  {
    id: "pet-groom",
    sectorId: "pet-care",
    labelEn: "Pet Grooming",
    labelDe: "Tierpflege",
    categorySlug: "pet-groom",
    icon: "✂️",
  },
];

export function getRequestSectorById(sectorId?: string | null) {
  if (!sectorId) return null;
  return REQUEST_SECTORS.find((sector) => sector.id === sectorId) || null;
}

export function getRequestBranchById(branchId?: string | null) {
  if (!branchId) return null;
  return REQUEST_BRANCHES.find((branch) => branch.id === branchId) || null;
}

export function getRequestBranchesByCategorySlug(categorySlug?: string | null) {
  const canonicalSlug = getCanonicalCategorySlug(categorySlug);
  if (!canonicalSlug) return [];
  return REQUEST_BRANCHES.filter(
    (branch) => branch.categorySlug === canonicalSlug,
  );
}

function getUniqueFallbackBranch(categorySlug?: string | null) {
  const matches = getRequestBranchesByCategorySlug(categorySlug);
  return matches.length === 1 ? matches[0] : null;
}

function getUniqueFallbackSector(categorySlug?: string | null) {
  const matches = getRequestBranchesByCategorySlug(categorySlug);
  const sectorIds = [...new Set(matches.map((branch) => branch.sectorId))];
  return sectorIds.length === 1 ? getRequestSectorById(sectorIds[0]) : null;
}

export function resolveRequestTaxonomy(input: {
  requestSector?: string | null;
  requestBranch?: string | null;
  categorySlug?: string | null;
}) {
  const branch =
    getRequestBranchById(input.requestBranch) ||
    getUniqueFallbackBranch(input.categorySlug);
  const sector =
    getRequestSectorById(input.requestSector) ||
    getRequestSectorById(branch?.sectorId) ||
    getUniqueFallbackSector(input.categorySlug);

  return {
    sectorId: sector?.id || null,
    sectorNameEn: sector?.labelEn || null,
    sectorNameDe: sector?.labelDe || null,
    branchId: branch?.id || null,
    branchNameEn: branch?.labelEn || null,
    branchNameDe: branch?.labelDe || null,
  };
}
