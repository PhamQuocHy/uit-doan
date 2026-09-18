import { loadEnvConfig } from "@next/env";
import { readFileSync } from "node:fs";
import { getPool } from "../src/lib/db";

loadEnvConfig(process.cwd(), true);
async function main() {
  try {
    await getPool().query(readFileSync("dacta/migrations/024_human_check_notifications.sql", "utf8"));
    console.log("Human Check notification table ready.");
  } finally { await getPool().end(); }
}
main().catch(() => { console.error("Cannot create Human Check table. Check database configuration and CREATE permission."); process.exitCode = 1; });
