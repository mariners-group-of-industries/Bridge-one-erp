/**
 * npm run demo:production -- seed   → writes the demo month (see production-demo.ts)
 * npm run demo:production -- clear  → removes only the demo records
 */
import "dotenv/config";
import { db } from "@/lib/prisma/client";
import { clearProductionDemo, seedProductionDemo } from "./production-demo";

function localToday(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

async function main() {
  const command = process.argv[2];
  if (command === "seed") {
    const summary = await seedProductionDemo(localToday(), (line) => console.log(line));
    console.log("\nDemo data ready:\n" + JSON.stringify(summary, null, 2));
  } else if (command === "clear") {
    console.log("Removed:", await clearProductionDemo());
  } else {
    console.log("Usage: npm run demo:production -- seed | clear");
    process.exitCode = 1;
  }
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => db().$disconnect());
