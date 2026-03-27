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
};

const REQUEST_SECTORS: RequestSectorDefinition[] = [
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

const REQUEST_BRANCHES: RequestBranchDefinition[] = [
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

export function resolveRequestTaxonomy(input: {
  requestSector?: string | null;
  requestBranch?: string | null;
  categorySlug?: string | null;
}) {
  const branchFromId = input.requestBranch
    ? REQUEST_BRANCHES.find((branch) => branch.id === input.requestBranch)
    : undefined;
  const branch =
    branchFromId ||
    (input.categorySlug
      ? REQUEST_BRANCHES.find((item) => item.categorySlug === input.categorySlug)
      : undefined);

  const sectorFromId = input.requestSector
    ? REQUEST_SECTORS.find((sector) => sector.id === input.requestSector)
    : undefined;
  const sector =
    sectorFromId ||
    (branch
      ? REQUEST_SECTORS.find((item) => item.id === branch.sectorId)
      : undefined);

  return {
    sectorId: sector?.id || input.requestSector || null,
    sectorNameEn: sector?.labelEn || null,
    sectorNameDe: sector?.labelDe || null,
    branchId: branch?.id || input.requestBranch || null,
    branchNameEn: branch?.labelEn || null,
    branchNameDe: branch?.labelDe || null,
  };
}
