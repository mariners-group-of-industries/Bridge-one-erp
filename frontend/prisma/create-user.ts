import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import * as argon2 from "argon2";

const prisma = new PrismaClient({
  adapter: new PrismaPg({
    connectionString: process.env.DIRECT_URL ?? process.env.DATABASE_URL!,
  }),
});

async function main() {
  const existing = await prisma.user.findUnique({ where: { phone: "01857055057" } });
  if (existing) {
    console.log("User already exists:", existing.id, existing.name, existing.phone);
    console.log("Resetting password to: U1234356@");
    const hash = await argon2.hash("U1234356@", { type: argon2.argon2id });
    await prisma.user.update({
      where: { id: existing.id },
      data: { passwordHash: hash, isActive: true },
    });
    console.log("Password reset done.");
  } else {
    const hash = await argon2.hash("U1234356@", { type: argon2.argon2id });
    const user = await prisma.user.create({
      data: {
        name: "Dev User",
        phone: "01857055057",
        passwordHash: hash,
        role: "ADMINISTRATOR",
        isMaster: true,
      },
    });
    console.log("Created user:", user.id, user.name, user.phone);
  }
  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
