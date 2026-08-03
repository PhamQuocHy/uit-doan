/**
 * Run SQL migrations in dacta/migrations against configured MySQL.
 * Usage: npx tsx scripts/run-migration.ts
 */
import fs from "fs";
import path from "path";
import mysql from "mysql2/promise";
import { loadEnv } from "./load-env";

loadEnv();

async function main() {
  const dir = path.join(process.cwd(), "dacta", "migrations");
  const files = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  const host = process.env.DB_HOST || "localhost";
  const user = process.env.DB_USER || "root";
  const password = process.env.DB_PASSWORD || "";
  const database = process.env.DB_NAME || "quan_ly_nvqs";
  const port = parseInt(process.env.DB_PORT || "3306", 10);

  const bootstrap = await mysql.createConnection({
    host,
    user,
    password,
    port,
    multipleStatements: true,
  });
  await bootstrap.query(
    `CREATE DATABASE IF NOT EXISTS \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
  );
  await bootstrap.end();

  const conn = await mysql.createConnection({
    host,
    user,
    password,
    database,
    port,
    multipleStatements: true,
  });

  console.log(`Connected to ${database}`);

  for (const file of files) {
    const sql = fs.readFileSync(path.join(dir, file), "utf8");
    console.log(`Running ${file}...`);
    await conn.query(sql);
    console.log(`OK ${file}`);
  }

  await conn.end();
  console.log("Migrations complete.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
