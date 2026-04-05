export type RequestSectorDefinition = {
  id: string;
  labelEn: string;
  labelDe: string;
  icon: string;
  colorClass: string;
  isActive: false;
};

export type RequestBranchDefinition = {
  id: string;
  sectorId: string;
  labelEn: string;
  labelDe: string;
  categorySlug: string;
  icon: string;
  isActive: true;
};

export type RequestTaxonomyCategoryKind = "sector" | "branch";

export type RequestTaxonomyCategory = {
  kind: RequestTaxonomyCategoryKind;
  id: string;
  slug: string;
  labelEn: string;
  labelDe: string;
  icon: string;
  isActive: boolean;
  parentId: string | null;
  sectorId?: string;
  colorClass?: string;
};

export const REQUEST_SECTORS: RequestSectorDefinition[] = [
  {
    id: "home-repair",
    labelEn: "Home Repair & Renovation",
    labelDe: "Hausreparatur & Renovierung",
    icon: "🧰",
    colorClass: "bg-emerald-100 text-emerald-800",
    isActive: false,
  },
  {
    id: "cleaning-care",
    labelEn: "Cleaning & Home Care",
    labelDe: "Reinigung & Haushaltspflege",
    icon: "🪄",
    colorClass: "bg-blue-100 text-blue-800",
    isActive: false,
  },
  {
    id: "education-hobby",
    labelEn: "Education, Courses & Hobby",
    labelDe: "Bildung, Kurse & Hobby",
    icon: "🎓",
    colorClass: "bg-violet-100 text-violet-800",
    isActive: false,
  },
  {
    id: "art-events",
    labelEn: "Art, Photo & Events",
    labelDe: "Kunst, Foto & Events",
    icon: "🎭",
    colorClass: "bg-amber-100 text-amber-800",
    isActive: false,
  },
  {
    id: "health-beauty",
    labelEn: "Health & Beauty",
    labelDe: "Gesundheit & Beauty",
    icon: "🪞",
    colorClass: "bg-rose-100 text-rose-800",
    isActive: false,
  },
  {
    id: "digital-tech",
    labelEn: "Digital & Technology",
    labelDe: "Digital & Technologie",
    icon: "🧠",
    colorClass: "bg-lime-100 text-lime-800",
    isActive: false,
  },
  {
    id: "logistics",
    labelEn: "Transport & Logistics",
    labelDe: "Transport & Logistik",
    icon: "🚚",
    colorClass: "bg-pink-100 text-pink-800",
    isActive: false,
  },
  {
    id: "pet-care",
    labelEn: "Pet Services",
    labelDe: "Haustierdienste",
    icon: "🐾",
    colorClass: "bg-orange-100 text-orange-800",
    isActive: false,
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
    isActive: true,
  },
  {
    id: "plumber",
    sectorId: "home-repair",
    labelEn: "Plumber",
    labelDe: "Installateur",
    categorySlug: "plumber",
    icon: "🔧",
    isActive: true,
  },
  {
    id: "painter",
    sectorId: "home-repair",
    labelEn: "Painter",
    labelDe: "Maler",
    categorySlug: "painter",
    icon: "🎨",
    isActive: true,
  },
  {
    id: "locksmith",
    sectorId: "home-repair",
    labelEn: "Locksmith",
    labelDe: "Schluesseldienst",
    categorySlug: "locksmith",
    icon: "🔐",
    isActive: true,
  },
  {
    id: "renovation",
    sectorId: "home-repair",
    labelEn: "Renovation",
    labelDe: "Renovierung",
    categorySlug: "renovation",
    icon: "🔨",
    isActive: true,
  },
  {
    id: "home-cleaning",
    sectorId: "cleaning-care",
    labelEn: "Home Cleaning",
    labelDe: "Hausreinigung",
    categorySlug: "home-cleaning",
    icon: "🧹",
    isActive: true,
  },
  {
    id: "office-cleaning",
    sectorId: "cleaning-care",
    labelEn: "Office Cleaning",
    labelDe: "Bueroreinigung",
    categorySlug: "office-cleaning",
    icon: "🧼",
    isActive: true,
  },
  {
    id: "deep-cleaning",
    sectorId: "cleaning-care",
    labelEn: "Deep Cleaning",
    labelDe: "Grundreinigung",
    categorySlug: "deep-cleaning",
    icon: "✨",
    isActive: true,
  },
  {
    id: "garden-maintenance",
    sectorId: "cleaning-care",
    labelEn: "Garden Maintenance",
    labelDe: "Gartenpflege",
    categorySlug: "garden-maintenance",
    icon: "🌳",
    isActive: true,
  },
  {
    id: "math",
    sectorId: "education-hobby",
    labelEn: "Math Lessons",
    labelDe: "Matheunterricht",
    categorySlug: "math",
    icon: "📚",
    isActive: true,
  },
  {
    id: "english",
    sectorId: "education-hobby",
    labelEn: "English Lessons",
    labelDe: "Englischunterricht",
    categorySlug: "english",
    icon: "🗣️",
    isActive: true,
  },
  {
    id: "music",
    sectorId: "education-hobby",
    labelEn: "Music Lessons",
    labelDe: "Musikunterricht",
    categorySlug: "music",
    icon: "🎵",
    isActive: true,
  },
  {
    id: "wedding-photo",
    sectorId: "art-events",
    labelEn: "Wedding Photographer",
    labelDe: "Hochzeitsfotograf",
    categorySlug: "wedding-photo",
    icon: "📸",
    isActive: true,
  },
  {
    id: "event-photo",
    sectorId: "art-events",
    labelEn: "Event Photographer",
    labelDe: "Eventfotograf",
    categorySlug: "event-photo",
    icon: "📷",
    isActive: true,
  },
  {
    id: "video",
    sectorId: "art-events",
    labelEn: "Video Shooting",
    labelDe: "Videoaufnahme",
    categorySlug: "video",
    icon: "🎬",
    isActive: true,
  },
  {
    id: "beauty",
    sectorId: "health-beauty",
    labelEn: "Beauty Service",
    labelDe: "Beautydienst",
    categorySlug: "beauty",
    icon: "💄",
    isActive: true,
  },
  {
    id: "hair",
    sectorId: "health-beauty",
    labelEn: "Hairdresser (Home Visit)",
    labelDe: "Friseur (Hausbesuch)",
    categorySlug: "hair",
    icon: "💇",
    isActive: true,
  },
  {
    id: "computer",
    sectorId: "digital-tech",
    labelEn: "Computer Help",
    labelDe: "Computerhilfe",
    categorySlug: "computer",
    icon: "💻",
    isActive: true,
  },
  {
    id: "software",
    sectorId: "digital-tech",
    labelEn: "Software & IT Support",
    labelDe: "Software & IT Support",
    categorySlug: "software",
    icon: "🖥️",
    isActive: true,
  },
  {
    id: "website",
    sectorId: "digital-tech",
    labelEn: "Website Development",
    labelDe: "Webentwicklung",
    categorySlug: "website",
    icon: "🌐",
    isActive: true,
  },
  {
    id: "moving",
    sectorId: "logistics",
    labelEn: "Home Moving",
    labelDe: "Umzug",
    categorySlug: "moving",
    icon: "📦",
    isActive: true,
  },
  {
    id: "furniture",
    sectorId: "logistics",
    labelEn: "Furniture Assembly",
    labelDe: "Moebelmontage",
    categorySlug: "furniture",
    icon: "🪑",
    isActive: true,
  },
  {
    id: "storage",
    sectorId: "logistics",
    labelEn: "Storage & Mini Warehouse",
    labelDe: "Lagerung",
    categorySlug: "storage",
    icon: "🏷️",
    isActive: true,
  },
  {
    id: "pet-sitter",
    sectorId: "pet-care",
    labelEn: "Pet Sitting",
    labelDe: "Tiersitting",
    categorySlug: "pet-sitter",
    icon: "🐾",
    isActive: true,
  },
  {
    id: "dog-walk",
    sectorId: "pet-care",
    labelEn: "Dog Walking",
    labelDe: "Hundeservice",
    categorySlug: "dog-walk",
    icon: "🦮",
    isActive: true,
  },
  {
    id: "pet-groom",
    sectorId: "pet-care",
    labelEn: "Pet Grooming",
    labelDe: "Tierpflege",
    categorySlug: "pet-groom",
    icon: "✂️",
    isActive: true,
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
  if (!categorySlug) return [];
  return REQUEST_BRANCHES.filter(
    (branch) => branch.categorySlug === categorySlug,
  );
}

export function getRequestTaxonomyCategoryBySlug(categorySlug?: string | null) {
  if (!categorySlug) return null;

  const sector = getRequestSectorById(categorySlug);
  if (sector) {
    return {
      kind: "sector" as const,
      id: sector.id,
      slug: sector.id,
      labelEn: sector.labelEn,
      labelDe: sector.labelDe,
      icon: sector.icon,
      isActive: sector.isActive,
      parentId: null,
      colorClass: sector.colorClass,
    };
  }

  const branch = REQUEST_BRANCHES.find(
    (item) => item.categorySlug === categorySlug,
  );
  if (!branch) return null;

  return {
    kind: "branch" as const,
    id: branch.id,
    slug: branch.categorySlug,
    labelEn: branch.labelEn,
    labelDe: branch.labelDe,
    icon: branch.icon,
    isActive: branch.isActive,
    parentId: branch.sectorId,
    sectorId: branch.sectorId,
  };
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
