// CLI entry point for `npm run db:seed`. The actual seeding logic lives in
// src/lib/seedData.ts so it's also importable in-process from the running
// API server (Configuration -> "Reset seed data") and covered by the main
// `tsc --noEmit` in apps/api, which this prisma/ directory is not.
import { runSeed } from "../src/lib/seedData";
import { prisma } from "../src/lib/prisma";

runSeed()
  .then((summary) => console.log(summary))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
