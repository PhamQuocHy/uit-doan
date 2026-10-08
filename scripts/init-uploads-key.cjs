/* eslint-disable @typescript-eslint/no-require-imports -- standalone Node CommonJS script */
const fs = require("node:fs");
const path = require("node:path");
const { randomBytes } = require("node:crypto");
const dotenv = require("dotenv");

const file = ".env.local";
const text = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "";
const env = dotenv.parse(text);
const fallback = fs.existsSync(".env") ? dotenv.parse(fs.readFileSync(".env")) : {};
const current = env.UPLOADS_ENCRYPTION_KEY ?? fallback.UPLOADS_ENCRYPTION_KEY ?? process.env.UPLOADS_ENCRYPTION_KEY;
let encryptedFiles = 0;
let legacyFiles = 0;
function count(folder, encrypted) {
  if (!fs.existsSync(folder)) return;
  for (const entry of fs.readdirSync(folder, { withFileTypes: true })) {
    if (entry.isSymbolicLink()) throw new Error("Upload symlink requires manual review");
    const child = path.join(folder, entry.name);
    if (entry.isDirectory()) count(child, encrypted);
    else if (entry.isFile()) { if (encrypted) encryptedFiles++; else legacyFiles++; }
  }
}
count("storage/uploads", true);
count("public/uploads", false);
console.log(JSON.stringify({ keyValid: /^[a-f0-9]{64}$/i.test(current || ""), encryptedFiles, legacyFiles }));
if (!/^[a-f0-9]{64}$/i.test(current || "")) {
  if (encryptedFiles) throw new Error("Existing encrypted uploads require recovery of the original key; refusing to generate a replacement");
  if (!process.argv.includes("--apply")) process.exit(0);
  const key = /^[a-f0-9]{64}$/i.test((current || "").trim()) ? current.trim() : randomBytes(32).toString("hex");
  const lines = text.split(/\r?\n/).filter((line) => !/^\s*(?:export\s+)?UPLOADS_ENCRYPTION_KEY\s*=/.test(line));
  fs.writeFileSync(file, `${lines.join("\n").replace(/\n*$/, "")}\nUPLOADS_ENCRYPTION_KEY=${key}\n`);
  console.log("Configured a valid uploads encryption key in .env.local (value hidden).");
}
