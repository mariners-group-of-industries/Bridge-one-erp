import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DIRECT_URL ?? process.env.DATABASE_URL! }),
});

async function main() {
  const rows = await prisma.employee.findMany({
    select: { id: true, employeeCode: true, name: true, office: { select: { name: true } } },
    orderBy: { employeeCode: "asc" },
    take: 20,
  });
  for (const r of rows) {
    console.log(`${r.id}  ${r.employeeCode}  ${r.name}  [${r.office.name}]`);
  }
  await prisma.$disconnect();
}
main();
