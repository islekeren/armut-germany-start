// Prepares the web e2e database (migrate + seed) and, unless dev servers are
// requested, builds the API and web apps that Playwright serves.
import { execFileSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";
import path from "node:path";
import process from "node:process";

const rootDir = path.resolve(process.cwd(), "../..");
const apiDir = path.join(rootDir, "apps", "api");
const npx = process.platform === "win32" ? "npx.cmd" : "npx";
const npm = process.platform === "win32" ? "npm.cmd" : "npm";

const env = {
  ...process.env,
  DATABASE_URL:
    process.env.DATABASE_URL ||
    "postgresql://postgres:postgres@127.0.0.1:5433/armut_e2e_web",
  NEXT_PUBLIC_API_URL:
    process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000",
};

const run = (command, args, cwd) =>
  execFileSync(command, args, { cwd, stdio: "inherit", env });

// Start every run from a clean, seeded database so records created by earlier
// runs cannot push fresh test data off paginated lists. Refuse to wipe
// anything that does not look like a disposable test database.
const databaseName = new URL(env.DATABASE_URL).pathname.slice(1);
if (!/e2e|test/i.test(databaseName) && process.env.E2E_ALLOW_RESET !== "true") {
  throw new Error(
    `Refusing to reset "${databaseName}". Point DATABASE_URL at an e2e/test database or set E2E_ALLOW_RESET=true.`,
  );
}
run(npx, ["prisma", "migrate", "deploy"], apiDir);

const prisma = new PrismaClient({
  datasources: { db: { url: env.DATABASE_URL } },
});
try {
  const tables = await prisma.$queryRaw`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  if (tables.length > 0) {
    const list = tables
      .map(({ tablename }) => `"public"."${tablename}"`)
      .join(", ");
    await prisma.$executeRawUnsafe(
      `TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`,
    );
  }
} finally {
  await prisma.$disconnect();
}

run(npm, ["run", "db:seed"], apiDir);

if (
  process.env.E2E_DEV_SERVERS !== "true" &&
  process.env.E2E_SKIP_BUILD !== "true"
) {
  // Turbo caches both builds, so repeat runs are fast.
  run(npx, ["turbo", "run", "build", "--filter=web", "--filter=api"], rootDir);
}
