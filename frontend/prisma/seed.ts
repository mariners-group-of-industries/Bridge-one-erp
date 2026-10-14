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
  await prisma.userSession.deleteMany();
  await prisma.user.deleteMany();
  await prisma.termApplicability.deleteMany();
  await prisma.termsCondition.deleteMany();
  await prisma.officeAsset.deleteMany();
  await prisma.warehouse.deleteMany();
  await prisma.office.deleteMany();
  await prisma.businessUnit.deleteMany();
  await prisma.company.deleteMany();

  const company = await prisma.company.create({
    data: {
      name: "Mariners Group",
      address: "N/A",
      email: "N/A",
    },
  });

  const bu = await prisma.businessUnit.create({
    data: {
      companyId: company.id,
      name: "Mariners Group",
      address: "10th Floor, MG SAM Center, 12 Bir Uttam A. K. Khandakar Road, Mohakhali C/A, Dhaka-1212, Bangladesh",
      contactNumber: "01840484845",
      email: "info@marinersgroup.com.bd",
      dateFormat: "DD_MM_YYYY_DASH",
    },
  });

  const dhakaOffice = await prisma.office.create({
    data: {
      businessUnitId: bu.id,
      name: "Dhaka Head Office",
      address: "10th Floor, MG SAM Center, 12 Bir Uttam A. K. Khandakar Road, Mohakhali C/A, Dhaka-1212, Bangladesh",
      email: null,
      phone: null,
      binNumber: null,
    },
  });

  await prisma.warehouse.createMany({
    data: [
      { officeId: dhakaOffice.id, name: "Head Office WH" },
      { officeId: dhakaOffice.id, name: "ASSET WH HO" },
    ],
  });

  const factoryOffice = await prisma.office.create({
    data: {
      businessUnitId: bu.id,
      name: "MG Sirajganj Factory",
      address: "Nalka, Shengati, Raiganj, Sirajganj-6703",
      email: null,
      phone: null,
      binNumber: null,
    },
  });

  await prisma.warehouse.createMany({
    data: [
      { officeId: factoryOffice.id, name: "Material WH" },
      { officeId: factoryOffice.id, name: "Finished Goods (FG) WH" },
      { officeId: factoryOffice.id, name: "Maintenance WH" },
      { officeId: factoryOffice.id, name: "ASSET WH FAC" },
      { officeId: factoryOffice.id, name: "PD Snacks Store" },
      { officeId: factoryOffice.id, name: "PD Biscuit Store" },
      { officeId: factoryOffice.id, name: "Recycle WH" },
      { officeId: factoryOffice.id, name: "Stationary WH" },
    ],
  });

  console.log("Seed complete");
  console.log(`  Company:       ${company.name}`);
  console.log(`  Business Unit: ${bu.name}`);
  console.log(`  Offices:       Dhaka Head Office, MG Sirajganj Factory`);
  console.log(`  Warehouses:    10 total`);

  const seedPhone = process.env.SEED_ADMIN_PHONE;
  const seedPassword = process.env.SEED_ADMIN_PASSWORD;
  if (!seedPhone) throw new Error("SEED_ADMIN_PHONE env var is required");
  if (!seedPassword) throw new Error("SEED_ADMIN_PASSWORD env var is required");
  const passwordHash = await argon2.hash(seedPassword, { type: argon2.argon2id });
  await prisma.user.create({
    data: {
      name: "Dev User",
      phone: seedPhone,
      passwordHash,
      role: "ADMINISTRATOR",
      isMaster: true,
    },
  });
  console.log(`  User:          ${seedPhone} (ADMINISTRATOR, isMaster=true)`);
}

main()
  .catch((e) => { console.error(String(e instanceof Error ? e.message : e).replace(/\r|\n/g, " ")); process.exit(1); })
  .finally(() => prisma.$disconnect());
