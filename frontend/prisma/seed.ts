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

  const GULFESHA_ADDRESS = "Gulfesha Plaza (Level-10), 69 Outer Circuler Road, Boro Moghbazar, Dhaka";

  const officesData: { name: string; address: string; warehouses: string[] }[] = [
    {
      name: "Dhaka Head Office",
      address: "10th Floor, MG SAM Center, 12 Bir Uttam A. K. Khandakar Road, Mohakhali C/A, Dhaka-1212, Bangladesh",
      warehouses: ["Head Office WH", "ASSET WH HO"],
    },
    {
      name: "MG Sirajganj Factory",
      address: "Nalka,Shengati, Raiganj, Sirajganj-6703",
      warehouses: [
        "Material WH",
        "Finished Goods (FG) WH",
        "Maintenance WH",
        "ASSET WH FAC",
        "PD Snacks Store",
        "PD Biscuit Store",
        "Recycle WH",
        "Stationary WH",
      ],
    },
    {
      name: "MFAL-HO",
      address: GULFESHA_ADDRESS,
      warehouses: [],
    },
    {
      name: "MFIL-HO",
      address: GULFESHA_ADDRESS,
      warehouses: [],
    },
    {
      name: "MCTL-HO",
      address: GULFESHA_ADDRESS,
      warehouses: [],
    },
    {
      name: "BMPL-HO",
      address: GULFESHA_ADDRESS,
      warehouses: [],
    },
    {
      name: "MGV-PLC",
      address: GULFESHA_ADDRESS,
      warehouses: [],
    },
    {
      name: "MOHS-Eco",
      address: GULFESHA_ADDRESS,
      warehouses: ["MOHS_ECO_MW", "MOHS_ECO_CW"],
    },
    {
      name: "MFGL-HO",
      address: GULFESHA_ADDRESS,
      warehouses: [],
    },
    {
      name: "Marinozz",
      address: GULFESHA_ADDRESS,
      warehouses: ["MZ-M14-MW", "MZ-M14-PD"],
    },
    {
      name: "CFF-Chapai",
      address: GULFESHA_ADDRESS,
      warehouses: ["Fish Firm-MW", "Fish Firm-PD"],
    },
    {
      name: "MBBL-HO",
      address: GULFESHA_ADDRESS,
      warehouses: [],
    },
  ];

  let totalWarehouses = 0;
  for (const item of officesData) {
    const office = await prisma.office.create({
      data: {
        businessUnitId: bu.id,
        name: item.name,
        address: item.address,
        email: null,
        phone: null,
        binNumber: null,
      },
    });

    if (item.warehouses.length > 0) {
      await prisma.warehouse.createMany({
        data: item.warehouses.map((whName) => ({
          officeId: office.id,
          name: whName,
        })),
      });
      totalWarehouses += item.warehouses.length;
    }
  }

  console.log("Seed complete");
  console.log(`  Company:       ${company.name}`);
  console.log(`  Business Unit: ${bu.name}`);
  console.log(`  Offices:       ${officesData.length} total`);
  console.log(`  Warehouses:    ${totalWarehouses} total`);

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
