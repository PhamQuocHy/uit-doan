/* eslint-disable @typescript-eslint/no-require-imports -- standalone Node CommonJS script */
const fs = require("node:fs");
const mysql = require("mysql2/promise");
const dotenv = require("dotenv");
const { readDump } = require("./repair-sql-encoding.cjs");
const suspicious = (s) => typeof s === "string" && /\?{2,}|\uFFFD|Ã.|Ä.|á[º»]/u.test(s);
const quote = (s) => `\`${s.replace(/`/g, "``")}\``;

async function main() {
  const dump = process.argv[2] ? readDump(process.argv[2]) : new Map();
  for (const file of [".env.local", ".env"]) if (fs.existsSync(file)) {
    for (const [key, value] of Object.entries(dotenv.parse(fs.readFileSync(file)))) {
      if (process.env[key] === undefined) process.env[key] = value;
    }
  }
  const c = await mysql.createConnection({ host: process.env.DB_HOST || "localhost", user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "", database: process.env.DB_NAME || "quan_ly_nvqs",
    port: Number(process.env.DB_PORT || 3306), charset: "utf8mb4_unicode_ci", dateStrings: true });
  try {
    const [schema] = await c.query("SELECT TABLE_NAME, COLUMN_NAME, DATA_TYPE, COLUMN_KEY, COLUMN_TYPE, COLUMN_COMMENT FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() ORDER BY TABLE_NAME, ORDINAL_POSITION");
    console.log(JSON.stringify({ damagedEnumDefinitions: schema.filter((r) => /^(enum|set)$/.test(r.DATA_TYPE) && suspicious(r.COLUMN_TYPE)) }));
    const [tables] = await c.query("SELECT TABLE_NAME, TABLE_COMMENT FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE()");
    console.log(JSON.stringify({ damagedColumnComments: schema.filter((r) => suspicious(r.COLUMN_COMMENT)).map((r) => ({ table: r.TABLE_NAME, column: r.COLUMN_NAME })),
      damagedTableComments: tables.filter((r) => suspicious(r.TABLE_COMMENT)).map((r) => r.TABLE_NAME) }));
    let totalSuspect = 0;
    let columnCount = 0;
    for (const table of [...new Set(schema.map((r) => r.TABLE_NAME))]) {
      const cols = schema.filter((r) => r.TABLE_NAME === table);
      const texts = cols.filter((r) => /^(varchar|char|text|tinytext|mediumtext|longtext|enum|set|json)$/.test(r.DATA_TYPE)).map((r) => r.COLUMN_NAME);
      const keys = cols.filter((r) => r.COLUMN_KEY === "PRI").map((r) => r.COLUMN_NAME);
      if (!texts.length) continue;
      columnCount += texts.length;
      const [rows] = await c.query(`SELECT ${[...new Set([...keys, ...texts])].map(quote).join(",")} FROM ${quote(table)}`);
      const source = dump.get(table);
      const keyOf = (r) => JSON.stringify(keys.map((k) => String(r[k])));
      const originals = new Map();
      if (source && keys.length && keys.every((k) => source.columns.includes(k))) {
        for (const row of source.rows) {
          const obj = Object.fromEntries(source.columns.map((col, i) => [col, row[i]]));
          originals.set(keyOf(obj), obj);
        }
      }
      const findings = [];
      for (const col of texts) {
        let suspects = 0; let sourceSuspects = 0; let different = 0;
        for (const row of rows) {
          const original = originals.get(keyOf(row));
          if (suspicious(row[col])) suspects++;
          if (original && suspicious(original[col])) sourceSuspects++;
          if (original && typeof original[col] === "string" && original[col] !== row[col]) different++;
        }
        totalSuspect += suspects;
        if (suspects || different) findings.push({ column: col, suspicious: suspects, sourceSuspicious: sourceSuspects, differentFromDump: different });
      }
      console.log(JSON.stringify({ table, rows: rows.length, textColumns: texts.length, findings }));
    }
    console.log(JSON.stringify({ auditedTextColumns: columnCount, suspiciousFields: totalSuspect }));
  } finally { await c.end(); }
  const sourceIssues = [];
  function walk(folder) {
    for (const item of fs.readdirSync(folder, { withFileTypes: true })) {
      const file = `${folder}/${item.name}`;
      if (item.isDirectory()) walk(file);
      else if (/\.(tsx?|json|css)$/.test(file) && /\uFFFD|Ã.|Ä.|á[º»]/u.test(fs.readFileSync(file, "utf8"))) sourceIssues.push(file);
    }
  }
  walk("src");
  console.log(JSON.stringify({ sourceFilesWithSuspiciousText: sourceIssues }));
}
main().catch((e) => { console.error(e.code || e.name); process.exitCode = 1; });
