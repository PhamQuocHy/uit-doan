/**
 * Codemod: legacy Apple/Tailwind-scale colors -> M3 Expressive tokens.
 * Run: node scripts/m3-codemod.mjs [--dry]
 */
import fs from "node:fs";
import path from "node:path";

const DRY = process.argv.includes("--dry");
const ROOT = "src";
const SKIP_DIRS = new Set([".next", "node_modules", "m3"]);
// intentional olive brand constant + m3 kit source of truth
const SKIP_FILES = new Set([
  "src/components/mobile/MobileShell.tsx",
  "src/app/admin/reports/page.tsx", // CHART literal palette intentionally static
]);

// hex (lowercase, no #) -> token utility name
const HEX = {
  "007aff": "m3-primary",
  "0066d6": "m3-primary",
  "0a84ff": "m3-primary",
  "5ac8fa": "m3-primary",
  "2563eb": "m3-primary",
  "748c2c": "m3-primary",
  "34c759": "m3-success",
  "248a3d": "m3-success",
  "059669": "m3-success",
  "10b981": "m3-success",
  "16a34a": "m3-success",
  d1fae5: "m3-success-container",
  d97706: "m3-warning",
  fef3c7: "m3-warning-container",
  ff9500: "m3-warning",
  ff3b30: "m3-error",
  c93400: "m3-error",
  dc2626: "m3-error",
  ef4444: "m3-error",
  "991b1b": "m3-error",
  b91c1c: "m3-error",
  fee2e2: "m3-error-container",
  ffdad6: "m3-error-container",
  fecaca: "m3-error-container",
  fef2f2: "m3-error-container",
  fff5f5: "m3-error-container",
  "8944ab": "m3-tertiary",
  af52de: "m3-tertiary",
  "7c3aed": "m3-tertiary",
  e5e5ea: "m3-outline-variant",
  e8e8ed: "m3-outline-variant",
  c7c7cc: "m3-outline-variant",
  e5e7eb: "m3-outline-variant",
  d1d1d6: "m3-outline-variant",
  edf4dc: "m3-outline-variant",
  "1d1d1f": "m3-on-surface",
  "3a3a3c": "m3-on-surface",
  "3b491e": "m3-on-surface",
  f5f5f7: "m3-surface-high",
  f8fafb: "m3-surface-high",
  f2f4f6: "m3-surface-high",
  f3f4f6: "m3-surface-high",
  f8fae8: "m3-surface-high",
  f0f4e4: "m3-surface-high",
  "6e6e73": "m3-on-surface-variant",
  "636366": "m3-on-surface-variant",
  "8e8e93": "m3-on-surface-variant",
  "86868b": "m3-on-surface-variant",
  "6b7280": "m3-on-surface-variant",
  "9ca3af": "m3-on-surface-variant",
  dbeafe: "m3-primary-container",
  eedeba: "m3-tertiary-container",
  ffffff: "m3-surface-lowest",
  f0fdf4: "m3-success-container",
};

// css var reference for inline styles / color-mix (provider var + fallback)
const VARS = {
  "m3-primary": "var(--m3-primary, #1a73e8)",
  "m3-primary-container": "var(--m3-primary-container, #dae9fb)",
  "m3-error": "var(--m3-error, #ba1a1a)",
  "m3-error-container": "var(--m3-error-container, #ffdad6)",
  "m3-success": "var(--color-m3-success)",
  "m3-success-container": "var(--color-m3-success-container)",
  "m3-warning": "var(--color-m3-warning)",
  "m3-warning-container": "var(--color-m3-warning-container)",
  "m3-tertiary": "var(--m3-tertiary, #655c5e)",
  "m3-tertiary-container": "var(--m3-tertiary-container, #eddfe1)",
  "m3-on-surface": "var(--m3-on-surface, #1c1b1c)",
  "m3-on-surface-variant": "var(--m3-on-surface-variant, #49464a)",
  "m3-surface-high": "var(--m3-surface-container-high, #ebe6e6)",
  "m3-surface-lowest": "var(--m3-surface-container-lowest, #ffffff)",
  "m3-outline-variant": "var(--m3-outline-variant, #cbc5ca)",
};

// rgb triple (no spaces) -> token
const RGBA = {
  "0,122,255": "m3-primary",
  "26,115,232": "m3-primary",
  "116,140,44": "m3-primary",
  "255,59,48": "m3-error",
  "52,199,89": "m3-success",
  "255,149,0": "m3-warning",
  "175,82,222": "m3-tertiary",
  "239,68,68": "m3-error",
  "220,38,38": "m3-error",
};

const FAMILY = {
  gray: "neutral",
  slate: "neutral",
  zinc: "neutral",
  neutral: "neutral",
  stone: "neutral",
  blue: "primary",
  sky: "primary",
  cyan: "primary",
  indigo: "primary",
  red: "error",
  rose: "error",
  green: "success",
  emerald: "success",
  teal: "success",
  lime: "success",
  amber: "warning",
  yellow: "warning",
  orange: "warning",
  purple: "secondary",
  fuchsia: "secondary",
  pink: "secondary",
};

const FAMS = Object.keys(FAMILY).join("|");
const UTILS =
  "bg|text|border-t|border-b|border-l|border-r|border|ring|divide|from|via|to|fill|stroke|accent|decoration|outline|shadow|caret";
const SHADES = "950|900|800|700|600|500|400|300|200|100|50";
const RGBA_ALT = Object.keys(RGBA)
  .map((k) => k.split(",").join("[, ]+"))
  .join("|");

function scaleMap(scale, shade, util) {
  const fam = FAMILY[scale];
  const n = Number(shade);
  const isText = /^text(-\d)?$/.test(util);
  const isBorder =
    /^border/.test(util) || util === "divide" || util === "ring" || util === "outline";
  if (fam === "neutral") {
    if (isText) {
      if (n >= 800) return "m3-on-surface";
      if (n >= 300) return "m3-on-surface-variant";
      return "m3-outline";
    }
    if (isBorder) return n >= 400 ? "m3-outline" : "m3-outline-variant";
    if (n <= 50) return "m3-surface-high";
    if (n <= 100) return "m3-surface-container";
    return "m3-surface-highest";
  }
  const role = {
    primary: "primary",
    error: "error",
    success: "success",
    warning: "warning",
    secondary: "secondary",
  }[fam];
  if (isBorder) return `m3-${role}`;
  if (isText) {
    if (role === "primary") return n >= 700 ? "m3-on-primary-container" : "m3-primary";
    if (n >= 600) return `m3-on-${role}-container`;
    return `m3-${role}`;
  }
  return `m3-${role}-container`;
}

function pct(alpha) {
  const p = Math.round(parseFloat(alpha) * 100);
  return Math.max(1, Math.min(100, p));
}

function transform(src) {
  let s = src;

  // 1. bracketed colored rgba in class utilities: bg-[rgba(0,122,255,0.08)] -> bg-m3-primary/8
  s = s.replace(
    new RegExp(
      `\\b(${UTILS})-\\[\\s*rgba\\(\\s*(${Object.keys(RGBA).join("|")})\\s*,\\s*([\\d.]+)\\s*\\)\\s*\\]`,
      "g",
    ),
    (_m, util, rgb, a) => `${util}-${RGBA[rgb]}/${pct(a)}`,
  );

  // 2. bracketed hex: bg-[#007aff]/50 -> bg-m3-primary/50
  s = s.replace(/\[#([0-9a-fA-F]{6})\]/g, (m, hex) => HEX[hex.toLowerCase()] ?? m);

  // 3. bare colored rgba(...) in JS/style -> color-mix on token
  s = s.replace(
    new RegExp(`rgba\\(\\s*(${RGBA_ALT})\\s*,\\s*([\\d.]+)\\s*\\)`, "g"),
    (_m, rgb, a) =>
      `color-mix(in srgb, ${VARS[RGBA[rgb.replace(/\s+/g, "")]]} ${pct(a)}%, transparent)`,
  );

  // 4. hex string literals ("#fff…"/'#ffffff') -> var(--token)
  s = s.replace(/(["'])#([0-9a-fA-F]{6})\1/g, (m, q, hex) => {
    const tok = HEX[hex.toLowerCase()];
    return tok && VARS[tok] ? `"${VARS[tok]}"` : m;
  });

  // 5. hex embedded inside style strings (linear-gradient(..., #fff 0%...) etc.)
  s = s.replace(/#([0-9a-fA-F]{6})\b/g, (m, hex) => {
    const tok = HEX[hex.toLowerCase()];
    return tok && VARS[tok] ? VARS[tok] : m;
  });

  // 6. white-on-color text: color: "#fff" -> onPrimary
  s = s.replace(/color:\s*"#fff"/g, 'color: "var(--m3-on-primary, #ffffff)"');

  // 7. tailwind scale utilities -> token utilities
  s = s.replace(
    new RegExp(`(^|[\\s:"'\`{,])(${UTILS})-(${FAMS})-(${SHADES})\\b`, "g"),
    (m, lead, util, scale, shade) => {
      const tok = scaleMap(scale, shade, util);
      return tok ? `${lead}${util}-${tok}` : m;
    },
  );

  // 8. plain white/black surfaces
  s = s.replace(/\bbg-white\b/g, "bg-m3-surface-lowest");
  s = s.replace(/\btext-black\b/g, "text-m3-on-surface");

  return s;
}

const files = [];
(function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name).replace(/\\/g, "/");
    if (e.isDirectory()) {
      if (!SKIP_DIRS.has(e.name)) walk(p);
    } else if (
      (/\.tsx$/.test(e.name) || (/\.ts$/.test(e.name) && p.startsWith("src/lib/"))) &&
      !SKIP_FILES.has(p)
    )
      files.push(p);
  }
})(ROOT);

let changed = 0;
for (const f of files) {
  const before = fs.readFileSync(f, "utf8");
  const after = transform(before);
  if (after !== before) {
    changed++;
    console.log((DRY ? "[dry] " : "") + f);
    if (!DRY) fs.writeFileSync(f, after);
  }
}
console.log(`done: ${changed}/${files.length} files`);
