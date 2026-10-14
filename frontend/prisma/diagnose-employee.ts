import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const prisma = new PrismaClient({
  adapter: new PrismaPg({
    connectionString: process.env.DIRECT_URL ?? process.env.DATABASE_URL!,
  }),
});

async function run() {
  const id = "bbbbbbbb-0005-0005-0005-000000000005";

  // Step 1: does the employee row exist?
  const exists = await prisma.employee.findUnique({
    where: { id },
    select: { id: true, officeId: true },
  });
  console.log("1. exists:", exists);

  // Step 2: does the office exist?
  if (exists) {
    const office = await prisma.office.findUnique({
      where: { id: exists.officeId },
      include: { businessUnit: true },
    });
    console.log("2. office:", office ? { id: office.id, name: office.name, businessUnitId: office.businessUnitId, businessUnit: office.businessUnit } : null);
  }

  // Step 3: full load like loadEmployee does
  const emp = await prisma.employee.findUnique({
    where: { id },
    include: { office: { include: { businessUnit: true } } },
  });
  console.log("3. emp.office:", emp?.office ? { name: emp.office.name, businessUnitId: emp.office.businessUnitId } : null);
  console.log("3. emp.office.businessUnit:", emp?.office?.businessUnit ?? null);

  await prisma.$disconnect();
}

run().catch((e) => { console.error(String(e instanceof Error ? e.message : e).replace(/\r?\n/g, " ")); process.exit(1); });
