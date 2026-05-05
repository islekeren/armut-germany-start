import { execFileSync } from "node:child_process";
import path from "node:path";

const apiDir = path.resolve(process.cwd(), "../api");
const databaseUrl =
  process.env.DATABASE_URL ||
  "postgresql://postgres:postgres@127.0.0.1:5432/armut_test";

const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";

execFileSync(npmCommand, ["run", "db:seed"], {
  cwd: apiDir,
  stdio: "inherit",
  env: {
    ...process.env,
    DATABASE_URL: databaseUrl,
  },
});
