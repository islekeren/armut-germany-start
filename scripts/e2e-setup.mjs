// Applies Prisma migrations to both e2e databases created by
// docker-compose.test.yml. Override either URL via env to target other hosts.
import { execFileSync } from "node:child_process";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const rootDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const apiDir = path.join(rootDir, "apps", "api");
const npx = process.platform === "win32" ? "npx.cmd" : "npx";

const databases = {
  api:
    process.env.E2E_API_DATABASE_URL ||
    "postgresql://postgres:postgres@127.0.0.1:5433/armut_e2e_api",
  web:
    process.env.E2E_WEB_DATABASE_URL ||
    "postgresql://postgres:postgres@127.0.0.1:5433/armut_e2e_web",
};

execFileSync(npx, ["prisma", "generate"], { cwd: apiDir, stdio: "inherit" });

for (const [suite, url] of Object.entries(databases)) {
  console.log(`\nMigrating ${suite} e2e database`);
  execFileSync(npx, ["prisma", "migrate", "deploy"], {
    cwd: apiDir,
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: url },
  });
}
