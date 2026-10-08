/* eslint-disable @typescript-eslint/no-require-imports -- standalone Node CommonJS script */
// Import a UTF-8 dump through native mysql stdin without PowerShell text conversion.
// Usage: node scripts/import-sql-utf8.cjs "C:\path\dump.sql"
// Target database must be ready for the dump; this does not clear existing tables.
const fs = require("node:fs");
const { spawn } = require("node:child_process");
const dotenv = require("dotenv");

const file = process.argv[2];
if (!file || !fs.existsSync(file)) {
  console.error("Usage: node scripts/import-sql-utf8.cjs dump.sql");
  process.exit(1);
}
new TextDecoder("utf-8", { fatal: true }).decode(fs.readFileSync(file));
for (const env of [".env.local", ".env"]) {
  if (!fs.existsSync(env)) continue;
  for (const [key, value] of Object.entries(dotenv.parse(fs.readFileSync(env)))) {
    if (process.env[key] === undefined) process.env[key] = value;
  }
}
const executable = process.env.MYSQL_BIN || (fs.existsSync("C:/xampp/mysql/bin/mysql.exe") ? "C:/xampp/mysql/bin/mysql.exe" : "mysql");
const child = spawn(executable, [
  "--default-character-set=utf8mb4", "--binary-mode", "--batch",
  `--host=${process.env.DB_HOST || "localhost"}`,
  `--port=${process.env.DB_PORT || "3306"}`,
  `--user=${process.env.DB_USER || "root"}`,
  `--database=${process.env.DB_NAME || "quan_ly_nvqs"}`,
], {
  windowsHide: true,
  env: { ...process.env, MYSQL_PWD: process.env.DB_PASSWORD || "" },
  stdio: ["pipe", "inherit", "inherit"],
});
const input = fs.createReadStream(file);
input.on("error", () => { console.error("Cannot read SQL file"); child.kill(); process.exitCode = 1; });
child.on("error", (error) => { input.destroy(); console.error("Cannot start mysql:", error.code); process.exitCode = 1; });
child.stdin.on("error", (error) => {
  input.destroy();
  if (error.code !== "EPIPE") console.error("SQL input failed:", error.code);
});
child.on("close", (code) => {
  input.destroy();
  process.exitCode = code || 0;
  if (code === 0) console.log("UTF-8 SQL import completed.");
});
input.pipe(child.stdin);
