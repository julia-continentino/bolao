import path from "node:path";
import { defineConfig } from "prisma/config";

try {
  // Prisma CLI no longer auto-loads .env once a prisma.config.ts exists.
  process.loadEnvFile(path.join(__dirname, ".env"));
} catch {
  // .env may not exist yet (e.g. in CI where vars are injected directly).
}

export default defineConfig({
  schema: path.join("prisma", "schema.prisma"),
  migrations: {
    seed: "tsx prisma/seed.ts",
  },
});
