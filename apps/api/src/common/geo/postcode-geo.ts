import { DE_POSTCODE_DATA } from "./de-postcodes.data";

export interface GeoPoint {
  lat: number;
  lng: number;
}

let exactIndex: Map<string, GeoPoint> | null = null;
let prefixIndex: Map<string, GeoPoint> | null = null;

function buildIndexes() {
  exactIndex = new Map();
  const prefixSums = new Map<string, { lat: number; lng: number; count: number }>();

  for (const entry of DE_POSTCODE_DATA.split(";")) {
    const [code, lat, lng] = entry.split(",");
    const point = { lat: Number(lat), lng: Number(lng) };
    exactIndex.set(code, point);

    const prefix = code.slice(0, 3);
    const sum = prefixSums.get(prefix) ?? { lat: 0, lng: 0, count: 0 };
    sum.lat += point.lat;
    sum.lng += point.lng;
    sum.count += 1;
    prefixSums.set(prefix, sum);
  }

  prefixIndex = new Map(
    [...prefixSums.entries()].map(([prefix, sum]) => [
      prefix,
      { lat: sum.lat / sum.count, lng: sum.lng / sum.count },
    ]),
  );
}

/**
 * Approximate centre of a German postcode. Falls back to the centre of the
 * postcode's 3-digit area when the exact code is missing from the dataset
 * (e.g. very new codes). Returns null for anything that is not a known
 * 5-digit German postcode area.
 */
export function lookupPostcode(postalCode?: string | null): GeoPoint | null {
  const code = postalCode?.trim();
  if (!code || !/^\d{5}$/.test(code)) return null;

  if (!exactIndex || !prefixIndex) buildIndexes();

  return exactIndex!.get(code) ?? prefixIndex!.get(code.slice(0, 3)) ?? null;
}

/** 0,0 is what clients sent before geocoding existed; treat it as unknown. */
export function hasCoordinates(
  lat?: number | null,
  lng?: number | null,
): boolean {
  return (
    typeof lat === "number" &&
    typeof lng === "number" &&
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    !(lat === 0 && lng === 0)
  );
}

/** Great-circle distance in kilometres. */
export function distanceKm(a: GeoPoint, b: GeoPoint): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

/** Lat/lng box that contains every point within `radiusKm` of `center`. */
export function boundingBox(center: GeoPoint, radiusKm: number) {
  const latDelta = radiusKm / 111;
  const lngDelta =
    radiusKm / (111 * Math.max(Math.cos((center.lat * Math.PI) / 180), 0.01));
  return {
    minLat: center.lat - latDelta,
    maxLat: center.lat + latDelta,
    minLng: center.lng - lngDelta,
    maxLng: center.lng + lngDelta,
  };
}
