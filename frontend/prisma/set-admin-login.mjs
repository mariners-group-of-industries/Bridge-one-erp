// Changes the master (administrator) account's login phone and password.
//
//   Target database: TARGET_DATABASE_URL, else DIRECT_URL / DATABASE_URL from .env
//   New login:       NEW_PHONE and NEW_PASSWORD (never printed or stored in plain text)
//
// PowerShell, from frontend/:
//   $env:TARGET_DATABASE_URL = "<connection string>"; $env:NEW_PHONE = "<phone>"; $env:NEW_PASSWORD = "<password>"
//   node prisma/set-admin-login.mjs
//   Remove-Item Env:TARGET_DATABASE_URL, Env:NEW_PHONE, Env:NEW_PASSWORD
//
// Existing sessions of that account are signed out.
import { fileURLToPath } from "node:url";
import argon2 from "argon2";
import dotenv from "dotenv";
import pg from "pg";

dotenv.config({ path: fileURLToPath(new URL("../.env", import.meta.url)), quiet: true });

(async () => {
  const connectionString = process.env.TARGET_DATABASE_URL || process.env.DIRECT_URL || process.env.DATABASE_URL;
  const phone = process.env.NEW_PHONE?.trim();
  const password = process.env.NEW_PASSWORD;
  if (!connectionString) throw new Error("Set TARGET_DATABASE_URL (or DATABASE_URL in .env).");
  if (!phone || !password) throw new Error("Set NEW_PHONE and NEW_PASSWORD.");
  console.log(`Database host: ${new URL(connectionString).hostname}`);

  const client = new pg.Client({ connectionString, ssl: { rejectUnauthorized: false } });
  await client.connect();
  try {
    await client.query("BEGIN");
    const masters = await client.query('select id from users where "isMaster" = true');
    if (masters.rowCount !== 1) throw new Error(`Expected exactly one master user, found ${masters.rowCount}.`);
    const id = masters.rows[0].id;
    if ((await client.query("select 1 from users where phone = $1 and id <> $2", [phone, id])).rowCount) throw new Error("Another user already uses that phone number.");
    const hash = await argon2.hash(password, { type: argon2.argon2id });
    await client.query('update users set phone = $1, "passwordHash" = $2, "isActive" = true, "updatedAt" = now() where id = $3', [phone, hash, id]);
    const sessions = await client.query('delete from user_sessions where "userId" = $1', [id]);
    await client.query("COMMIT");
    console.log(`Done: the master account now signs in with the new phone and password; ${sessions.rowCount} old session(s) signed out.`);
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    await client.end();
  }
})().catch((error) => {
  console.error(`Failed: ${error.message}`);
  process.exit(1);
});
