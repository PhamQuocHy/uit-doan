/**
 * Seed legal NVQS documents from data/legal-docs into MySQL.
 * Usage: npm run db:seed-legal
 */
import { loadEnv } from "./load-env";

loadEnv();

async function main() {
  // Dynamic import after env load
  const { pingDb } = await import("../src/lib/db");
  const { upsertLegalDocumentsToDb, listLegalDocumentsFromDisk } = await import(
    "../src/lib/legal-docs"
  );

  const disk = listLegalDocumentsFromDisk(false);
  console.log(`Found ${disk.length} documents on disk`);

  const ok = await pingDb();
  if (!ok) {
    console.error("MySQL not reachable. Check .env DB_* settings.");
    process.exit(1);
  }

  const n = await upsertLegalDocumentsToDb();
  console.log(`Upserted ${n} rows into legal_documents`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
