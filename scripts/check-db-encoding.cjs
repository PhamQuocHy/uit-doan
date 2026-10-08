/* eslint-disable @typescript-eslint/no-require-imports -- standalone Node CommonJS script */
// Read-only diagnosis. Never prints credentials or citizen names.
const fs = require("node:fs");
const dotenv = require("dotenv");
const mysql = require("mysql2/promise");

for (const file of [".env.local", ".env"]) {
  if (!fs.existsSync(file)) continue;
  for (const [key, value] of Object.entries(dotenv.parse(fs.readFileSync(file)))) {
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

async function main() {
  const bytes = fs.readFileSync("quan_ly_nqvs.sql");
  try {
    const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    console.log("SQL file: valid UTF-8");
    console.log("SQL file contains replacement characters:", text.includes("\uFFFD"));
    console.log("SQL file contains repeated question marks:", /\?{2,}/.test(text));
  } catch {
    console.log("SQL file: invalid UTF-8");
  }
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || "localhost",
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME || "quan_ly_nvqs",
    port: Number(process.env.DB_PORT || 3306),
    connectTimeout: 5000,
  });
  try {
    const queries = [
      "SHOW VARIABLES WHERE Variable_name IN ('character_set_client','character_set_connection','character_set_results','character_set_database','collation_connection','collation_database')",
      "SELECT TABLE_COLLATION, COUNT(*) AS tables_count FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() GROUP BY TABLE_COLLATION",
      "SELECT name, HEX(name) AS bytes FROM hierarchy_units WHERE code='92'",
      "SELECT COUNT(*) AS total, SUM(LOCATE(BINARY '?', BINARY full_name) > 0) AS names_with_question_marks, SUM(LOCATE(BINARY 'Ã', BINARY full_name) > 0 OR LOCATE(BINARY 'Ä', BINARY full_name) > 0 OR LOCATE(BINARY 'áº', BINARY full_name) > 0 OR LOCATE(BINARY 'á»', BINARY full_name) > 0 OR LOCATE(BINARY '�', BINARY full_name) > 0) AS possible_mojibake_names FROM citizens",
      "SELECT COUNT(*) AS total, SUM(LOCATE(BINARY '?', BINARY name) > 0) AS names_with_question_marks FROM hierarchy_units",
    ];
    for (const query of queries) {
      console.log(JSON.stringify((await connection.query(query))[0], null, 2));
    }
  } finally {
    await connection.end();
  }
}

main().catch((error) => {
  console.error("Encoding check failed:", error.code || error.name);
  process.exitCode = 1;
});
