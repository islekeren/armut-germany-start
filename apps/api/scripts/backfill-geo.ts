/**
 * Fills in coordinates for rows saved before postcode geocoding existed
 * (the web client used to send 0,0). Safe to re-run: only rows still at 0,0
 * with a resolvable postcode are changed.
 *
 *   npm run geo:backfill --workspace=api
 */
import { PrismaClient } from "@prisma/client";
import * as dotenv from "dotenv";
import { lookupPostcode } from "../src/common/geo/postcode-geo";

dotenv.config();

async function main() {
  const prisma = new PrismaClient();
  try {
    const requests = await prisma.serviceRequest.findMany({
      where: { lat: 0, lng: 0 },
      select: { id: true, postalCode: true },
    });
    let updatedRequests = 0;
    for (const request of requests) {
      const point = lookupPostcode(request.postalCode);
      if (!point) continue;
      await prisma.serviceRequest.update({
        where: { id: request.id },
        data: { lat: point.lat, lng: point.lng },
      });
      updatedRequests += 1;
    }

    const providers = await prisma.provider.findMany({
      where: { serviceAreaLat: 0, serviceAreaLng: 0 },
      select: { id: true, profile: { select: { postalCode: true } } },
    });
    let updatedProviders = 0;
    for (const provider of providers) {
      const point = lookupPostcode(provider.profile?.postalCode);
      if (!point) continue;
      await prisma.provider.update({
        where: { id: provider.id },
        data: { serviceAreaLat: point.lat, serviceAreaLng: point.lng },
      });
      updatedProviders += 1;
    }

    console.log(
      `Requests: ${updatedRequests}/${requests.length} updated. ` +
        `Providers: ${updatedProviders}/${providers.length} updated ` +
        "(the rest have no usable postcode).",
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
