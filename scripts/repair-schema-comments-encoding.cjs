/* eslint-disable @typescript-eslint/no-require-imports -- standalone Node CommonJS script */
const fs = require("node:fs");
const path = require("node:path");
const mysql = require("mysql2/promise");
const dotenv = require("dotenv");
const { parseValues, damagedUtf8 } = require("./repair-sql-encoding.cjs");
const quote = (s) => `\`${s.replace(/`/g, "``")}\``;
const literal = "'(?:\\\\.|''|[^'])*'";
const commentPattern = () => new RegExp(`COMMENT\\s+(${literal})`);

async function main() {
  const sql = new TextDecoder("utf-8", { fatal: true }).decode(fs.readFileSync(process.argv[2]));
  const definitions = new Map([...sql.matchAll(/CREATE TABLE `([^`]+)`\s*\(([\s\S]*?)\) ENGINE=([^\n]+);/g)].map((m) => [m[1], m]));
  for (const f of [".env.local", ".env"]) if (fs.existsSync(f)) {
    for (const [k, v] of Object.entries(dotenv.parse(fs.readFileSync(f)))) if (process.env[k] === undefined) process.env[k] = v;
  }
  const c = await mysql.createConnection({ host: process.env.DB_HOST || "localhost", user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "", database: process.env.DB_NAME || "quan_ly_nvqs",
    port: Number(process.env.DB_PORT || 3306), charset: "utf8mb4_unicode_ci" });
  try {
    const [columns] = await c.query("SELECT TABLE_NAME, COLUMN_NAME, COLUMN_COMMENT FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE()");
    const [tables] = await c.query("SELECT TABLE_NAME, TABLE_COMMENT FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE()");
    const plans = [];
    for (const table of tables) {
      const source = definitions.get(table.TABLE_NAME);
      if (!source) continue;
      const [create] = await c.query(`SHOW CREATE TABLE ${quote(table.TABLE_NAME)}`);
      const current = create[0]["Create Table"];
      const clauses = [];
      for (const col of columns.filter((r) => r.TABLE_NAME === table.TABLE_NAME)) {
        const sourceLine = source[2].split("\n").find((line) => line.trimStart().startsWith(`${quote(col.COLUMN_NAME)} `));
        const match = sourceLine?.match(commentPattern());
        if (!match) continue;
        const original = parseValues(`(${match[1]})`)[0][0];
        if (original === col.COLUMN_COMMENT || damagedUtf8(original) !== col.COLUMN_COMMENT) continue;
        const currentLine = current.split("\n").find((line) => line.trimStart().startsWith(`${quote(col.COLUMN_NAME)} `));
        if (!currentLine || !commentPattern().test(currentLine)) throw new Error("Cannot safely locate column comment");
        const replacement = currentLine.trim().replace(/,$/, "").replace(commentPattern(), `COMMENT ${c.escape(original)}`);
        clauses.push(`MODIFY COLUMN ${replacement}`);
      }
      const tableMatch = source[3].match(new RegExp(`COMMENT=(${literal})`));
      if (tableMatch) {
        const original = parseValues(`(${tableMatch[1]})`)[0][0];
        if (original !== table.TABLE_COMMENT && damagedUtf8(original) === table.TABLE_COMMENT) clauses.push(`COMMENT=${c.escape(original)}`);
      }
      if (clauses.length) plans.push({ table: table.TABLE_NAME, before: current, statement: `ALTER TABLE ${quote(table.TABLE_NAME)} ${clauses.join(", ")}`, comments: clauses.length });
    }
    console.log(`Recoverable schema comments: ${plans.reduce((s, p) => s + p.comments, 0)}`);
    if (!process.argv.includes("--apply") || !plans.length) return;
    const folder = path.join(process.cwd(), "storage", "encoding-backups");
    fs.mkdirSync(folder, { recursive: true });
    const backup = path.join(folder, `schema-comments-${Date.now()}.json`);
    fs.writeFileSync(backup, JSON.stringify(plans), { flag: "wx" });
    console.log(`Backup saved: ${backup}`);
    for (const plan of plans) { await c.query(plan.statement); console.log(`Restored comments: ${plan.table}`); }
  } finally { await c.end(); }
}
main().catch((e) => { console.error(e.code || e.message); process.exitCode = 1; });
