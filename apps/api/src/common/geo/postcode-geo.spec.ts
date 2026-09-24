import {
  boundingBox,
  distanceKm,
  hasCoordinates,
  lookupPostcode,
} from "./postcode-geo";

describe("postcode geo", () => {
  it("resolves known German postcodes", () => {
    const berlin = lookupPostcode("10115");
    const munich = lookupPostcode("80331");

    expect(berlin).toEqual({ lat: expect.any(Number), lng: expect.any(Number) });
    expect(berlin!.lat).toBeCloseTo(52.53, 1);
    expect(munich!.lng).toBeCloseTo(11.57, 1);
  });

  it("falls back to the 3-digit area and rejects invalid input", () => {
    // 10119 exists; 10199 does not, but the 101xx area does.
    expect(lookupPostcode("10199")).not.toBeNull();
    expect(lookupPostcode("1011")).toBeNull();
    expect(lookupPostcode("abcde")).toBeNull();
    expect(lookupPostcode(undefined)).toBeNull();
  });

  it("measures Berlin to Munich at roughly 500 km", () => {
    const km = distanceKm(lookupPostcode("10115")!, lookupPostcode("80331")!);
    expect(km).toBeGreaterThan(480);
    expect(km).toBeLessThan(520);
  });

  it("treats 0,0 as missing coordinates", () => {
    expect(hasCoordinates(0, 0)).toBe(false);
    expect(hasCoordinates(null, 13.4)).toBe(false);
    expect(hasCoordinates(52.5, 13.4)).toBe(true);
  });

  it("builds a bounding box around a point", () => {
    const box = boundingBox({ lat: 52.5, lng: 13.4 }, 25);
    expect(box.minLat).toBeLessThan(52.5);
    expect(box.maxLng).toBeGreaterThan(13.4);
  });
});
