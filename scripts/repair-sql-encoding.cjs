/* eslint-disable @typescript-eslint/no-require-imports -- standalone Node CommonJS script */
// Restore only text whose UTF-8 bytes were replaced by '?' during terminal import.
// Dry run by default. --apply writes a private backup before a transaction.
const fs = require("node:fs");
const path = require("node:path");
const mysql = require("mysql2/promise");
const dotenv = require("dotenv");

function parseValues(text) {
  const rows = [];
  let i = 0;
  while (i < text.length) {
    if (/[\s,]/.test(text[i])) { i++; continue; }
    if (text[i] !== "(") throw new Error("Unexpected SQL values syntax");
    i++;
    const row = [];
    while (i < text.length) {
      while (/\s/.test(text[i])) i++;
      let value = "";
      if (text[i] === "'") {
        i++;
        let closed = false;
        while (i < text.length) {
          const ch = text[i++];
          if (ch === "\\") {
            const escaped = text[i++];
            value += ({ "0": "\0", n: "\n", r: "\r", t: "\t", b: "\b", Z: "\x1a" })[escaped] ?? escaped;
          } else if (ch === "'") {
            if (text[i] === "'") { value += "'"; i++; }
            else { closed = true; break; }
          } else value += ch;
        }
        if (!closed) throw new Error("Unterminated SQL string");
      } else {
        const start = i;
        while (i < text.length && text[i] !== "," && text[i] !== ")") i++;
        value = text.slice(start, i).trim();
        if (value === "NULL") value = null;
        else if (!/^-?\d+(\.\d+)?$/.test(value)) throw new Error("Unsupported SQL literal");
      }
      row.push(value);
      while (/\s/.test(text[i])) i++;
      if (text[i] === ",") { i++; continue; }
      if (text[i] !== ")") throw new Error("Invalid SQL row");
      i++;
      break;
    }
    rows.push(row);
  }
  return rows;
}

function readDump(file) {
  const text = new TextDecoder("utf-8", { fatal: true }).decode(fs.readFileSync(file));
  const tables = new Map();
  const re = /INSERT INTO `([^`]+)`\s*\(([^)]+)\)\s*VALUES\s*/g;
  let match;
  while ((match = re.exec(text))) {
    const start = re.lastIndex;
    let quoted = false;
    let end = start;
    for (; end < text.length; end++) {
      if (quoted && text[end] === "\\") { end++; continue; }
      if (text[end] === "'") {
        if (quoted && text[end + 1] === "'") { end++; continue; }
        quoted = !quoted;
      }
      if (!quoted && text[end] === ";") break;
    }
    if (end === text.length) throw new Error("Unterminated INSERT");
    const columns = [...match[2].matchAll(/`([^`]+)`/g)].map((m) => m[1]);
    const rows = parseValues(text.slice(start, end));
    if (rows.some((r) => r.length !== columns.length)) throw new Error("SQL column count mismatch");
    const existing = tables.get(match[1]);
    if (existing && JSON.stringify(existing.columns) !== JSON.stringify(columns)) throw new Error("Inconsistent INSERT columns");
    if (existing) existing.rows.push(...rows);
    else tables.set(match[1], { columns, rows });
    re.lastIndex = end + 1;
  }
  return tables;
}

const identifier = (s) => `\`${s.replace(/`/g, "``")}\``;
const damagedUtf8 = (s) => [...Buffer.from(s, "utf8")].map((b) => b > 127 ? "?" : String.fromCharCode(b)).join("");

async function main() {
  const file = process.argv[2];
  if (!file || file.startsWith("--")) throw new Error("Usage: node scripts/repair-sql-encoding.cjs dump.sql [--apply]");
  const dump = readDump(file);
  for (const env of [".env.local", ".env"]) {
    if (!fs.existsSync(env)) continue;
    for (const [key, value] of Object.entries(dotenv.parse(fs.readFileSync(env)))) {
      if (process.env[key] === undefined) process.env[key] = value;
    }
  }
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || "localhost", user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "", database: process.env.DB_NAME || "quan_ly_nvqs",
    port: Number(process.env.DB_PORT || 3306), charset: "utf8mb4_unicode_ci",
    dateStrings: true, connectTimeout: 5000,
  });
  try {
    const [schema] = await connection.query("SELECT TABLE_NAME, COLUMN_NAME, DATA_TYPE, COLUMN_KEY, EXTRA FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() ORDER BY TABLE_NAME, ORDINAL_POSITION");
    const [engines] = await connection.query("SELECT TABLE_NAME, ENGINE FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE()");
    const plans = [];
    for (const [table, source] of dump) {
      const cols = schema.filter((c) => c.TABLE_NAME === table);
      const keys = cols.filter((c) => c.COLUMN_KEY === "PRI").map((c) => c.COLUMN_NAME);
      const texts = cols.filter((c) => /^(varchar|char|text|tinytext|mediumtext|longtext)$/.test(c.DATA_TYPE) && source.columns.includes(c.COLUMN_NAME)).map((c) => c.COLUMN_NAME);
      if (!keys.length || !texts.length || keys.some((k) => !source.columns.includes(k))) continue;
      const selected = [...new Set([...keys, ...texts])];
      const [current] = await connection.query(`SELECT ${selected.map(identifier).join(",")} FROM ${identifier(table)}`);
      const keyOf = (row) => JSON.stringify(keys.map((k) => String(row[k])));
      const byKey = new Map(current.map((r) => [keyOf(r), r]));
      let changedRows = 0;
      let changedFields = 0;
      for (const values of source.rows) {
        const original = Object.fromEntries(source.columns.map((c, i) => [c, values[i]]));
        const row = byKey.get(keyOf(original));
        if (!row) continue;
        const changes = texts.filter((c) => typeof original[c] === "string" && typeof row[c] === "string" &&
          original[c] !== row[c] && !original[c].includes("\uFFFD") && /[^\x00-\x7f]/.test(original[c]) &&
          damagedUtf8(original[c]) === row[c]);
        if (!changes.length) continue;
        plans.push({ table, keys: Object.fromEntries(keys.map((k) => [k, row[k]])),
          preserve: cols.filter((c) => /on update/i.test(c.EXTRA)).map((c) => c.COLUMN_NAME),
          before: Object.fromEntries(changes.map((c) => [c, row[c]])),
          after: Object.fromEntries(changes.map((c) => [c, original[c]])) });
        changedRows++;
        changedFields += changes.length;
      }
      console.log(`${table}: ${source.rows.length} source rows; ${changedRows} rows / ${changedFields} fields recoverable`);
    }
    console.log(`Total recoverable rows: ${plans.length}`);
    if (!process.argv.includes("--apply") || !plans.length) return;
    if (plans.some((p) => engines.find((e) => e.TABLE_NAME === p.table)?.ENGINE !== "InnoDB")) {
      throw new Error("Repair requires transactional InnoDB tables");
    }
    const folder = path.join(process.cwd(), "storage", "encoding-backups");
    fs.mkdirSync(folder, { recursive: true });
    const backup = path.join(folder, `before-repair-${Date.now()}.json`);
    fs.writeFileSync(backup, JSON.stringify(plans), { flag: "wx" });
    console.log(`Backup saved: ${backup}`);
    await connection.beginTransaction();
    try {
      let count = 0;
      for (const plan of plans) {
        const fields = Object.keys(plan.after);
        const keyGuards = Object.entries(plan.keys);
        const textGuards = Object.entries(plan.before);
        const [result] = await connection.execute(
          `UPDATE ${identifier(plan.table)} SET ${[...fields.map((f) => `${identifier(f)}=?`), ...plan.preserve.map((f) => `${identifier(f)}=${identifier(f)}`)].join(",")} WHERE ${[...keyGuards.map(([k]) => `${identifier(k)}=?`), ...textGuards.map(([k]) => `BINARY ${identifier(k)} <=> BINARY ?`)].join(" AND ")}`,
          [...Object.values(plan.after), ...keyGuards.map(([, value]) => value), ...textGuards.map(([, value]) => value)],
        );
        if (result.affectedRows !== 1) throw new Error("Row changed during repair; rolling back");
        if (++count % 5000 === 0) console.log(`Repaired ${count} rows...`);
      }
      await connection.commit();
      console.log(`Committed ${plans.length} repaired rows.`);
    } catch (error) { await connection.rollback(); throw error; }
  } finally { await connection.end(); }
}

if (require.main === module) main().catch((error) => {
  console.error("Encoding repair failed:", error.code || error.message);
  process.exitCode = 1;
});
module.exports = { parseValues, readDump, damagedUtf8 };
