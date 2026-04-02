export type ProviderServiceSector = {
  id: string;
  labelEn: string;
  labelDe: string;
  colorClass: string;
};

export type ProviderServiceBranch = {
  id: string;
  sectorId: ProviderServiceSector["id"];
  labelEn: string;
  labelDe: string;
  categorySlug: string;
};

export const PROVIDER_SERVICE_SECTORS: ProviderServiceSector[] = [
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
    labelEn: "Education & Courses",
    labelDe: "Bildung & Kurse",
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

export const PROVIDER_SERVICE_BRANCHES: ProviderServiceBranch[] = [
  { id: "electrician", sectorId: "home-repair", labelEn: "Electrician", labelDe: "Elektriker", categorySlug: "electrician" },
  { id: "plumber", sectorId: "home-repair", labelEn: "Plumber", labelDe: "Installateur", categorySlug: "plumber" },
  { id: "painter", sectorId: "home-repair", labelEn: "Painter", labelDe: "Maler", categorySlug: "painter" },
  { id: "locksmith", sectorId: "home-repair", labelEn: "Locksmith", labelDe: "Schluesseldienst", categorySlug: "locksmith" },
  { id: "renovation-general", sectorId: "home-repair", labelEn: "Renovation", labelDe: "Renovierung", categorySlug: "renovation" },
  { id: "flooring", sectorId: "home-repair", labelEn: "Flooring", labelDe: "Bodenverlegung", categorySlug: "renovation" },
  { id: "wallpaper", sectorId: "home-repair", labelEn: "Wallpaper", labelDe: "Tapete", categorySlug: "renovation" },

  { id: "home-cleaning", sectorId: "cleaning-care", labelEn: "Home Cleaning", labelDe: "Hausreinigung", categorySlug: "cleaning" },
  { id: "office-cleaning", sectorId: "cleaning-care", labelEn: "Office Cleaning", labelDe: "Bueroreinigung", categorySlug: "cleaning" },
  { id: "deep-cleaning", sectorId: "cleaning-care", labelEn: "Deep Cleaning", labelDe: "Grundreinigung", categorySlug: "cleaning" },
  { id: "sofa-cleaning", sectorId: "cleaning-care", labelEn: "Sofa Cleaning", labelDe: "Sofareinigung", categorySlug: "cleaning" },
  { id: "garden-maintenance", sectorId: "cleaning-care", labelEn: "Garden Maintenance", labelDe: "Gartenpflege", categorySlug: "garden" },

  { id: "math-tutor", sectorId: "education-hobby", labelEn: "Math Tutor", labelDe: "Mathe Nachhilfe", categorySlug: "tutoring" },
  { id: "english-tutor", sectorId: "education-hobby", labelEn: "English Tutor", labelDe: "Englisch Nachhilfe", categorySlug: "tutoring" },
  { id: "music-lessons", sectorId: "education-hobby", labelEn: "Music Lessons", labelDe: "Musikunterricht", categorySlug: "tutoring" },
  { id: "driving-course", sectorId: "education-hobby", labelEn: "Driving Course", labelDe: "Fahrschule", categorySlug: "tutoring" },

  { id: "wedding-photo", sectorId: "art-events", labelEn: "Wedding Photographer", labelDe: "Hochzeitsfotograf", categorySlug: "photography" },
  { id: "event-photo", sectorId: "art-events", labelEn: "Event Photographer", labelDe: "Eventfotograf", categorySlug: "photography" },
  { id: "video-editing", sectorId: "art-events", labelEn: "Video Shooting & Editing", labelDe: "Videoaufnahme & Schnitt", categorySlug: "photography" },

  { id: "beauty-services", sectorId: "health-beauty", labelEn: "Beauty Services", labelDe: "Beauty Services", categorySlug: "cleaning" },
  { id: "home-haircut", sectorId: "health-beauty", labelEn: "Hairdresser (Home Visit)", labelDe: "Friseur (Hausbesuch)", categorySlug: "cleaning" },

  { id: "computer-help", sectorId: "digital-tech", labelEn: "Computer Help", labelDe: "Computerhilfe", categorySlug: "computerHelp" },
  { id: "software-support", sectorId: "digital-tech", labelEn: "Software & IT Support", labelDe: "Software & IT Support", categorySlug: "computerHelp" },
  { id: "website-dev", sectorId: "digital-tech", labelEn: "Website Development", labelDe: "Webentwicklung", categorySlug: "computerHelp" },

  { id: "moving-home", sectorId: "logistics", labelEn: "Home Moving", labelDe: "Umzug", categorySlug: "moving" },
  { id: "furniture-assembly", sectorId: "logistics", labelEn: "Furniture Assembly", labelDe: "Moebelmontage", categorySlug: "moving" },
  { id: "storage", sectorId: "logistics", labelEn: "Storage & Mini Warehouse", labelDe: "Lagerung", categorySlug: "moving" },

  { id: "pet-sitting", sectorId: "pet-care", labelEn: "Pet Sitting", labelDe: "Tiersitting", categorySlug: "petCare" },
  { id: "dog-walking", sectorId: "pet-care", labelEn: "Dog Walking", labelDe: "Hundeservice", categorySlug: "petCare" },
  { id: "pet-grooming", sectorId: "pet-care", labelEn: "Pet Grooming", labelDe: "Tierpflege", categorySlug: "petCare" },
];

export function getProviderServiceBranchLabel(
  branch: ProviderServiceBranch,
  locale?: string,
) {
  return locale?.startsWith("de") ? branch.labelDe : branch.labelEn;
}
