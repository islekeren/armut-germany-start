import type { Category } from "@/lib/api";

export type RequestSector = {
  id: string;
  labelEn: string;
  labelDe: string;
  colorClass: string;
};

export type RequestBranch = {
  id: string;
  sectorId: RequestSector["id"];
  labelEn: string;
  labelDe: string;
  categorySlug: string;
};

export const REQUEST_SECTORS: RequestSector[] = [
  {
    id: "home-repair",
    labelEn: "Home Repair & Renovation",
    labelDe: "Hausreparatur & Renovierung",
    colorClass: "bg-emerald-100 text-emerald-800",
  },
  {
    id: "cleaning-care",
    labelEn: "Cleaning & Home Care",
    labelDe: "Reinigung & Haushaltspflege",
    colorClass: "bg-blue-100 text-blue-800",
  },
  {
    id: "education-hobby",
    labelEn: "Education, Courses & Hobby",
    labelDe: "Bildung, Kurse & Hobby",
    colorClass: "bg-violet-100 text-violet-800",
  },
  {
    id: "art-events",
    labelEn: "Art, Photo & Events",
    labelDe: "Kunst, Foto & Events",
    colorClass: "bg-amber-100 text-amber-800",
  },
  {
    id: "health-beauty",
    labelEn: "Health & Beauty",
    labelDe: "Gesundheit & Beauty",
    colorClass: "bg-rose-100 text-rose-800",
  },
  {
    id: "digital-tech",
    labelEn: "Digital & Technology",
    labelDe: "Digital & Technologie",
    colorClass: "bg-lime-100 text-lime-800",
  },
  {
    id: "logistics",
    labelEn: "Transport & Logistics",
    labelDe: "Transport & Logistik",
    colorClass: "bg-pink-100 text-pink-800",
  },
  {
    id: "pet-care",
    labelEn: "Pet Services",
    labelDe: "Haustierdienste",
    colorClass: "bg-orange-100 text-orange-800",
  },
];

export const REQUEST_BRANCHES: RequestBranch[] = [
  {
    id: "electrician",
    sectorId: "home-repair",
    labelEn: "Electrician",
    labelDe: "Elektriker",
    categorySlug: "electrician",
  },
  {
    id: "plumber",
    sectorId: "home-repair",
    labelEn: "Plumber",
    labelDe: "Installateur",
    categorySlug: "plumber",
  },
  {
    id: "painter",
    sectorId: "home-repair",
    labelEn: "Painter",
    labelDe: "Maler",
    categorySlug: "painter",
  },
  {
    id: "locksmith",
    sectorId: "home-repair",
    labelEn: "Locksmith",
    labelDe: "Schluesseldienst",
    categorySlug: "locksmith",
  },
  {
    id: "renovation",
    sectorId: "home-repair",
    labelEn: "Renovation",
    labelDe: "Renovierung",
    categorySlug: "renovation",
  },
  {
    id: "home-cleaning",
    sectorId: "cleaning-care",
    labelEn: "Home Cleaning",
    labelDe: "Hausreinigung",
    categorySlug: "cleaning",
  },
  {
    id: "office-cleaning",
    sectorId: "cleaning-care",
    labelEn: "Office Cleaning",
    labelDe: "Bueroreinigung",
    categorySlug: "cleaning",
  },
  {
    id: "deep-cleaning",
    sectorId: "cleaning-care",
    labelEn: "Deep Cleaning",
    labelDe: "Grundreinigung",
    categorySlug: "cleaning",
  },
  {
    id: "garden-maintenance",
    sectorId: "cleaning-care",
    labelEn: "Garden Maintenance",
    labelDe: "Gartenpflege",
    categorySlug: "garden",
  },
  {
    id: "math",
    sectorId: "education-hobby",
    labelEn: "Math Lessons",
    labelDe: "Matheunterricht",
    categorySlug: "tutoring",
  },
  {
    id: "english",
    sectorId: "education-hobby",
    labelEn: "English Lessons",
    labelDe: "Englischunterricht",
    categorySlug: "tutoring",
  },
  {
    id: "music",
    sectorId: "education-hobby",
    labelEn: "Music Lessons",
    labelDe: "Musikunterricht",
    categorySlug: "tutoring",
  },
  {
    id: "wedding-photo",
    sectorId: "art-events",
    labelEn: "Wedding Photographer",
    labelDe: "Hochzeitsfotograf",
    categorySlug: "photography",
  },
  {
    id: "event-photo",
    sectorId: "art-events",
    labelEn: "Event Photographer",
    labelDe: "Eventfotograf",
    categorySlug: "photography",
  },
  {
    id: "video",
    sectorId: "art-events",
    labelEn: "Video Shooting",
    labelDe: "Videoaufnahme",
    categorySlug: "photography",
  },
  {
    id: "beauty",
    sectorId: "health-beauty",
    labelEn: "Beauty Service",
    labelDe: "Beautydienst",
    categorySlug: "cleaning",
  },
  {
    id: "hair",
    sectorId: "health-beauty",
    labelEn: "Hairdresser (Home Visit)",
    labelDe: "Friseur (Hausbesuch)",
    categorySlug: "cleaning",
  },
  {
    id: "computer",
    sectorId: "digital-tech",
    labelEn: "Computer Help",
    labelDe: "Computerhilfe",
    categorySlug: "computerHelp",
  },
  {
    id: "software",
    sectorId: "digital-tech",
    labelEn: "Software & IT Support",
    labelDe: "Software & IT Support",
    categorySlug: "computerHelp",
  },
  {
    id: "website",
    sectorId: "digital-tech",
    labelEn: "Website Development",
    labelDe: "Webentwicklung",
    categorySlug: "computerHelp",
  },
  {
    id: "moving",
    sectorId: "logistics",
    labelEn: "Home Moving",
    labelDe: "Umzug",
    categorySlug: "moving",
  },
  {
    id: "furniture",
    sectorId: "logistics",
    labelEn: "Furniture Assembly",
    labelDe: "Moebelmontage",
    categorySlug: "moving",
  },
  {
    id: "storage",
    sectorId: "logistics",
    labelEn: "Storage & Mini Warehouse",
    labelDe: "Lagerung",
    categorySlug: "moving",
  },
  {
    id: "pet-sitter",
    sectorId: "pet-care",
    labelEn: "Pet Sitting",
    labelDe: "Tiersitting",
    categorySlug: "petCare",
  },
  {
    id: "dog-walk",
    sectorId: "pet-care",
    labelEn: "Dog Walking",
    labelDe: "Hundeservice",
    categorySlug: "petCare",
  },
  {
    id: "pet-groom",
    sectorId: "pet-care",
    labelEn: "Pet Grooming",
    labelDe: "Tierpflege",
    categorySlug: "petCare",
  },
];

export function getCategoryDisplayName(category: Category, locale?: string) {
  return locale?.startsWith("de") ? category.nameDe : category.nameEn;
}

export function getSectorById(sectorId?: string | null) {
  if (!sectorId) return null;
  return REQUEST_SECTORS.find((sector) => sector.id === sectorId) || null;
}

export function getBranchById(branchId?: string | null) {
  if (!branchId) return null;
  return REQUEST_BRANCHES.find((branch) => branch.id === branchId) || null;
}

export function getFallbackBranchByCategorySlug(categorySlug?: string | null) {
  if (!categorySlug) return null;
  return (
    REQUEST_BRANCHES.find((branch) => branch.categorySlug === categorySlug) || null
  );
}

export function getSectorLabel(sector: RequestSector, locale?: string) {
  return locale?.startsWith("de") ? sector.labelDe : sector.labelEn;
}

export function getBranchLabel(branch: RequestBranch, locale?: string) {
  return locale?.startsWith("de") ? branch.labelDe : branch.labelEn;
}
