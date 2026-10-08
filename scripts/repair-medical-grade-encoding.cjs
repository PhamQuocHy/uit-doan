/* eslint-disable @typescript-eslint/no-require-imports -- standalone Node CommonJS script */
const fs = require("node:fs");
const path = require("node:path");
const mysql = require("mysql2/promise");
const dotenv = require("dotenv");
const { readDump, damagedUtf8 } = require("./repair-sql-encoding.cjs");

async function main() {
  const source = readDump(process.argv[2]).get("health_exams");
  if (!source) throw new Error("Missing original health_exams data");
  for (const f of [".env.local", ".env"]) if (fs.existsSync(f)) {
    for (const [k, v] of Object.entries(dotenv.parse(fs.readFileSync(f)))) if (process.env[k] === undefined) process.env[k] = v;
  }
  const c = await mysql.createConnection({ host: process.env.DB_HOST || "localhost", user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "", database: process.env.DB_NAME || "quan_ly_nvqs",
    port: Number(process.env.DB_PORT || 3306), charset: "utf8mb4_unicode_ci" });
  try {
    const correct = Array.from({ length: 6 }, (_, i) => `Loại ${i + 1}`);
    const broken = correct.map(damagedUtf8);
    const type = (values) => `enum(${values.map((v) => c.escape(v)).join(",")})`;
    const [definition] = await c.query("SHOW FULL COLUMNS FROM health_exams WHERE Field='medical_grade'");
    const [rows] = await c.query("SELECT id, medical_grade FROM health_exams");
    const idIndex = source.columns.indexOf("id");
    const gradeIndex = source.columns.indexOf("medical_grade");
    const originals = new Map(source.rows.map((r) => [r[idIndex], r[gradeIndex]]));
    const damaged = rows.filter((r) => broken.includes(r.medical_grade));
    for (const row of damaged) {
      if (originals.get(row.id) !== correct[broken.indexOf(row.medical_grade)]) throw new Error("Source grade mismatch; refusing repair");
    }
    console.log(`Damaged enum rows: ${damaged.length}`);
    if (!process.argv.includes("--apply") || !damaged.length) return;
    if (definition[0].Type !== type(broken) || definition[0].Null !== "YES" || definition[0].Default !== null) throw new Error("Unexpected enum definition");
    const folder = path.join(process.cwd(), "storage", "encoding-backups");
    fs.mkdirSync(folder, { recursive: true });
    const backup = path.join(folder, `medical-grade-${Date.now()}.json`);
    fs.writeFileSync(backup, JSON.stringify({ definition, rows }), { flag: "wx" });
    console.log(`Backup saved: ${backup}`);
    // Append values first, so existing enum values remain valid during conversion.
    await c.query(`ALTER TABLE health_exams MODIFY medical_grade ${type([...broken, ...correct])} DEFAULT NULL`);
    await c.beginTransaction();
    try {
      let changed = 0;
      for (let i = 0; i < correct.length; i++) {
        const [result] = await c.execute("UPDATE health_exams SET medical_grade=? WHERE BINARY medical_grade=BINARY ?", [correct[i], broken[i]]);
        changed += result.affectedRows;
      }
      if (changed !== damaged.length) throw new Error("Unexpected changed row count");
      await c.commit();
    } catch (error) { await c.rollback(); throw error; }
    await c.query(`ALTER TABLE health_exams MODIFY medical_grade ${type(correct)} DEFAULT NULL`);
    const [verified] = await c.query("SELECT id, medical_grade FROM health_exams");
    const byId = new Map(verified.map((r) => [r.id, r.medical_grade]));
    if (verified.length !== rows.length || rows.some((r) => byId.get(r.id) !== (broken.includes(r.medical_grade) ? correct[broken.indexOf(r.medical_grade)] : r.medical_grade))) throw new Error("Final verification failed");
    console.log(`Verified ${damaged.length} repaired grades and preserved all ${verified.length} rows.`);
  } finally { await c.end(); }
}
main().catch((e) => { console.error(e.code || e.message); process.exitCode = 1; });
