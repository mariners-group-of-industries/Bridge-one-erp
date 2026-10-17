import dotenv from "dotenv";
dotenv.config();

import { z } from "zod";

const envSchema = z.object({
  PORT: z.coerce.number().default(4000),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  API_BASE_URL: z.string().default("http://localhost:4000"),
  DATABASE_URL: z
    .string()
    .default("postgresql://postgres:postgres@localhost:5432/bridgeone_purchase?schema=public"),
  DIRECT_URL: z.string().optional(),
  DEFAULT_COMPANY_ID: z.string().default("comp-bridgeone-01"),
  DEFAULT_COMPANY_NAME: z.string().default("BridgeOne Technologies Ltd."),
  JWT_SECRET: z.string().min(16).default("bridgeone-super-secret-jwt-key-2026-production"),
  INVENTORY_SERVICE_STATUS: z.enum(["live", "simulated", "unconfigured"]).default("simulated"),
  FINANCE_SERVICE_STATUS: z.enum(["live", "simulated", "unconfigured"]).default("simulated"),
  HR_SERVICE_STATUS: z.enum(["live", "simulated", "unconfigured"]).default("simulated"),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("❌ Invalid environment variables configuration:");
  console.error(JSON.stringify(parsed.error.format(), null, 2));
  throw new Error("Configuration validation failed. Check your environment variables.");
}

export const env = parsed.data;
