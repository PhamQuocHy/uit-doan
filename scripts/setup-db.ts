/**
 * Create database (if missing), import base schema, run analytics migration, seed.
 * Usage: npx tsx scripts/setup-db.ts [--force-seed]
 */
import fs from "fs";
import path from "path";
import mysql from "mysql2/promise";
import { loadEnv } from "./load-env";

loadEnv();

const FORCE = process.argv.includes("--force-seed");

async function main() {
  const host = process.env.DB_HOST || "localhost";
  const user = process.env.DB_USER || "root";
  const password = process.env.DB_PASSWORD || "";
  const database = process.env.DB_NAME || "quan_ly_nvqs";
  const port = parseInt(process.env.DB_PORT || "3306", 10);

  console.log(`Connecting to MySQL ${host}:${port} as ${user}...`);
  const root = await mysql.createConnection({
    host,
    user,
    password,
    port,
    multipleStatements: true,
  });

  await root.query(
    `CREATE DATABASE IF NOT EXISTS \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
  );
  console.log(`Database ${database} ready.`);
  await root.end();

  const conn = await mysql.createConnection({
    host,
    user,
    password,
    database,
    port,
    multipleStatements: true,
  });

  const baseSqlPath = path.join(process.cwd(), "quan_ly_nqvs.sql");
  if (fs.existsSync(baseSqlPath)) {
    const [tables] = await conn.query("SHOW TABLES");
    if ((tables as unknown[]).length === 0) {
      console.log("Importing quan_ly_nqvs.sql...");
      const sql = fs.readFileSync(baseSqlPath, "utf8");
      await conn.query(sql);
      console.log("Base schema imported.");
    } else {
      console.log(`Base schema already present (${(tables as unknown[]).length} tables).`);
    }
  }

  const migDir = path.join(process.cwd(), "dacta", "migrations");
  const files = fs
    .readdirSync(migDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();
  for (const file of files) {
    console.log(`Running ${file}...`);
    await conn.query(fs.readFileSync(path.join(migDir, file), "utf8"));
  }
  await conn.end();
  console.log("Migrations done.");

  const { main: seedMain } = await import("./seed-analytics");
  if (FORCE) {
    if (!process.argv.includes("--force")) process.argv.push("--force");
  }
  await seedMain();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
