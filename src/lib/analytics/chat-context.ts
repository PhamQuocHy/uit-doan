import fs from "fs";
import path from "path";
import { db, getUnitDescendants, hierarchyUnits } from "@/lib/data";
import { STATUS_LABELS } from "@/lib/analytics/types";
import { pingDb, queryRows } from "@/lib/db";
import {
  buildLegalKnowledgeForAi,
  questionNeedsLegalContext,
} from "@/lib/legal-docs";
import type { RowDataPacket } from "mysql2";

type SessionScope = {
  hierarchyLevel: string;
  unitCode: string;
  name: string;
};

type ProvinceRef = { code: string; name: string };

function normalizeVn(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function loadProvinces(): ProvinceRef[] {
  try {
    const raw = JSON.parse(
      fs.readFileSync(
        path.join(process.cwd(), "src", "data", "provinces.json"),
        "utf8",
      ),
    ) as Array<{ code: number; name: string }>;
    return raw.map((p) => ({ code: String(p.code), name: p.name }));
  } catch {
    return hierarchyUnits
      .filter((u) => u.level === "tinh")
      .map((u) => ({ code: u.code, name: u.name }));
  }
}

const ALIASES: Record<string, string> = {
  hcm: "79",
  "ho chi minh": "79",
  "tp hcm": "79",
  "tp. hcm": "79",
  saigon: "79",
  "sai gon": "79",
  hanoi: "1",
  "ha noi": "1",
  "tp ha noi": "1",
  cantho: "92",
  "can tho": "92",
  "tp can tho": "92",
  danang: "48",
  "da nang": "48",
  "tp da nang": "48",
  haiphong: "31",
  "hai phong": "31",
  hue: "46",
};

/** Từ khóa tiếng Việt → mã trạng thái NVQS */
const STATUS_KEYWORDS: Array<{ keys: string[]; status: string }> = [
  { keys: ["da dau", "dau tuyen", "trung tuyen", "trungtuyen"], status: "trungtuyen" },
  { keys: ["rot tuyen", "rot", "truot tuyen", "truottuyen"], status: "truottuyen" },
  { keys: ["tam hoan", "tamhoan"], status: "tamhoan" },
  { keys: ["mien goi", "miengoi"], status: "miengoi" },
  { keys: ["nhap ngu", "nhapngu"], status: "nhapngu" },
  { keys: ["chua kham", "chuakham"], status: "chuakham" },
  { keys: ["dang kham", "dangkham"], status: "dangkham" },
];

export type CitizenQueryIntent = {
  mode: "list" | "count" | "overview";
  statuses: string[];
};

/** Nhận diện câu hỏi liệt kê / đếm theo trạng thái NVQS */
export function detectCitizenQueryIntent(question: string): CitizenQueryIntent | null {
  const q = normalizeVn(question);
  if (!q) return null;

  const listWords = [
    "liet ke",
    "danh sach",
    "ke ten",
    "ten nguoi",
    "nhung nguoi",
    "ai da",
    "cong dan",
    "ho so",
  ];
  const countWords = [
    "bao nhieu",
    "co may",
    "tong so",
    "dem",
    "thong ke",
    "tom tat",
    "tinh hinh",
  ];

  const isList = listWords.some((w) => q.includes(w));
  const isCount = countWords.some((w) => q.includes(w));
  if (!isList && !isCount) return null;

  const statuses: string[] = [];
  for (const { keys, status } of STATUS_KEYWORDS) {
    if (keys.some((k) => q.includes(k))) {
      statuses.push(status);
    }
  }

  // "đậu" đơn lẻ — tránh nhầm "đậu/không đậu" chung chung
  if (statuses.length === 0 && (q.includes(" da dau") || q.endsWith(" dau") || q.includes("dau tuyen"))) {
    statuses.push("trungtuyen");
  }

  if (statuses.length === 0) {
    if (q.includes("tam hoan")) statuses.push("tamhoan");
    if (q.includes("mien")) statuses.push("miengoi");
  }

  if (statuses.length === 0) return null;

  return {
    mode: isList ? "list" : isCount ? "count" : "overview",
    statuses: [...new Set(statuses)],
  };
}

function scopeWhereClause(
  scope: SessionScope,
  alias = "",
): { where: string; params: string[]; label: string } {
  const col = alias ? `${alias}.unit_code` : "unit_code";
  if (scope.hierarchyLevel === "bo") {
    return {
      where: `${col} IS NOT NULL AND ${col} <> ''`,
      params: [],
      label: "Toàn quốc",
    };
  }
  const unitName =
    hierarchyUnits.find((u) => u.code === scope.unitCode)?.name || scope.unitCode;
  return {
    where: `(${col} = ? OR ${col} LIKE CONCAT(?, '-%'))`,
    params: [scope.unitCode, scope.unitCode],
    label: unitName,
  };
}

/** Tìm tỉnh/TP được nhắc trong câu hỏi */
export function detectProvincesInQuestion(question: string): ProvinceRef[] {
  const provinces = loadProvinces();
  const q = normalizeVn(question);
  const found: ProvinceRef[] = [];
  const seen = new Set<string>();

  for (const [alias, code] of Object.entries(ALIASES)) {
    if (q.includes(alias)) {
      const p = provinces.find((x) => x.code === code);
      if (p && !seen.has(p.code)) {
        seen.add(p.code);
        found.push(p);
      }
    }
  }

  for (const p of provinces) {
    const full = normalizeVn(p.name);
    const short = full
      .replace(/^thanh pho\s+/, "")
      .replace(/^tinh\s+/, "")
      .trim();
    if (
      (full.length >= 4 && q.includes(full)) ||
      (short.length >= 4 && q.includes(short))
    ) {
      if (!seen.has(p.code)) {
        seen.add(p.code);
        found.push(p);
      }
    }
  }

  return found;
}

async function provinceTotalsMysql(): Promise<string[]> {
  const rows = await queryRows<
    (RowDataPacket & { tinh: string; cnt: number })[]
  >(
    `SELECT
       COALESCE(SUBSTRING_INDEX(unit_code, '-', 1), unit_code) AS tinh,
       COUNT(*) AS cnt
     FROM citizens
     WHERE unit_code IS NOT NULL AND unit_code <> ''
     GROUP BY tinh
     ORDER BY cnt DESC`,
  );

  const nameByCode = Object.fromEntries(
    loadProvinces().map((p) => [p.code, p.name]),
  );

  return rows.map((r) => {
    const name = nameByCode[r.tinh] || `Mã ${r.tinh}`;
    return `- ${name} (mã ${r.tinh}): ${Number(r.cnt)} hồ sơ`;
  });
}

async function nationalStatusBreakdownMysql(): Promise<string[]> {
  const rows = await queryRows<
    (RowDataPacket & { military_status: string; cnt: number })[]
  >(
    `SELECT military_status, COUNT(*) AS cnt
     FROM citizens
     GROUP BY military_status
     ORDER BY cnt DESC`,
  );
  const total = rows.reduce((s, r) => s + Number(r.cnt), 0);
  return [
    "### Phân bố trạng thái NVQS toàn quốc",
    `Tổng: ${total} hồ sơ`,
    ...rows.map(
      (r) =>
        `- ${STATUS_LABELS[r.military_status] || r.military_status}: ${Number(r.cnt)}`,
    ),
  ];
}

async function statusByProvinceMysql(
  statuses: string[],
  scope: SessionScope,
  detectedProvinces: ProvinceRef[] = [],
): Promise<string[]> {
  const scopeClause = scopeWhereClause(scope);
  const placeholders = statuses.map(() => "?").join(", ");
  const params: string[] = [...statuses, ...scopeClause.params];

  let provinceFilter = "";
  if (detectedProvinces.length > 0) {
    const provinceClauses = detectedProvinces.map(
      () => "(unit_code = ? OR unit_code LIKE CONCAT(?, '-%'))",
    );
    provinceFilter = ` AND (${provinceClauses.join(" OR ")})`;
    for (const p of detectedProvinces) {
      params.push(p.code, p.code);
    }
  }

  const rows = await queryRows<
    (RowDataPacket & { tinh: string; cnt: number })[]
  >(
    `SELECT
       COALESCE(SUBSTRING_INDEX(unit_code, '-', 1), unit_code) AS tinh,
       COUNT(*) AS cnt
     FROM citizens
     WHERE military_status IN (${placeholders})
       AND ${scopeClause.where}${provinceFilter}
     GROUP BY tinh
     ORDER BY cnt DESC, tinh ASC`,
    params,
  );

  const nameByCode = Object.fromEntries(
    loadProvinces().map((p) => [p.code, p.name]),
  );
  const statusLabel = statuses
    .map((s) => STATUS_LABELS[s] || s)
    .join(", ");

  return [
    `### Phân bố theo tỉnh/TP — trạng thái: ${statusLabel} (${scopeClause.label})`,
    `Số tỉnh/TP có dữ liệu: ${rows.length}`,
    ...rows.map((r) => {
      const name = nameByCode[r.tinh] || `Mã ${r.tinh}`;
      return `- ${name} (mã ${r.tinh}): ${Number(r.cnt)} hồ sơ`;
    }),
  ];
}

async function statusTotalMysql(
  statuses: string[],
  scope: SessionScope,
  detectedProvinces: ProvinceRef[] = [],
): Promise<number> {
  const scopeClause = scopeWhereClause(scope);
  const placeholders = statuses.map(() => "?").join(", ");
  const params: string[] = [...statuses, ...scopeClause.params];

  let provinceFilter = "";
  if (detectedProvinces.length > 0) {
    const provinceClauses = detectedProvinces.map(
      () => "(unit_code = ? OR unit_code LIKE CONCAT(?, '-%'))",
    );
    provinceFilter = ` AND (${provinceClauses.join(" OR ")})`;
    for (const p of detectedProvinces) {
      params.push(p.code, p.code);
    }
  }

  const [row] = await queryRows<(RowDataPacket & { cnt: number })[]>(
    `SELECT COUNT(*) AS cnt FROM citizens
     WHERE military_status IN (${placeholders})
       AND ${scopeClause.where}${provinceFilter}`,
    params,
  );
  return Number(row?.cnt || 0);
}

function statusByProvinceMemory(
  statuses: string[],
  scope: SessionScope,
  detectedProvinces: ProvinceRef[],
): { total: number; lines: string[] } {
  let all = db.citizens.findAll({ limit: 10000 }).data.filter((c) =>
    statuses.includes(c.militaryStatus),
  );

  if (scope.hierarchyLevel !== "bo") {
    all = all.filter(
      (c) =>
        c.unitCode === scope.unitCode ||
        c.unitCode?.startsWith(`${scope.unitCode}-`),
    );
  }

  if (detectedProvinces.length > 0) {
    const codes = new Set(detectedProvinces.map((p) => p.code));
    all = all.filter(
      (c) =>
        c.unitCode &&
        [...codes].some(
          (code) => c.unitCode === code || (c.unitCode?.startsWith(`${code}-`) ?? false),
        ),
    );
  }

  const nameByCode = Object.fromEntries(
    loadProvinces().map((p) => [p.code, p.name]),
  );
  const byProvince = new Map<string, number>();
  for (const c of all) {
    const tinh = c.unitCode?.split("-")[0] || "unknown";
    byProvince.set(tinh, (byProvince.get(tinh) || 0) + 1);
  }

  const lines = [...byProvince.entries()]
    .sort(([a], [b]) =>
      (nameByCode[a] || a).localeCompare(nameByCode[b] || b, "vi"),
    )
    .map(([tinh, cnt]) => {
      const name = nameByCode[tinh] || `Mã ${tinh}`;
      return `- ${name} (mã ${tinh}): ${cnt} hồ sơ`;
    });

  return { total: all.length, lines };
}

/** Trả lời trực tiếp chỉ số hồ sơ (không liệt kê từng người) */
export async function buildDirectCitizenStatsReply(
  scope: SessionScope,
  question: string,
): Promise<string | null> {
  const intent = detectCitizenQueryIntent(question);
  if (!intent) return null;

  const detected = detectProvincesInQuestion(question);
  const statusLabel = intent.statuses
    .map((s) => STATUS_LABELS[s] || s)
    .join(", ");
  const scopeClause = scopeWhereClause(scope);
  const dbOk = await pingDb();

  if (dbOk) {
    try {
      const total = await statusTotalMysql(intent.statuses, scope, detected);
      const byProvince = await statusByProvinceMysql(
        intent.statuses,
        scope,
        detected,
      );
      const provinceLines = byProvince.filter((l) => l.startsWith("- "));
      return [
        `Thống kê hồ sơ — trạng thái: ${statusLabel}`,
        `Phạm vi: ${scopeClause.label}`,
        `Tổng: ${total} hồ sơ`,
        "",
        detected.length > 0 ? "Theo địa bàn được hỏi:" : "Theo tỉnh/thành phố:",
        ...provinceLines,
      ].join("\n");
    } catch (e) {
      console.error("buildDirectCitizenStatsReply mysql:", e);
    }
  }

  const mem = statusByProvinceMemory(intent.statuses, scope, detected);
  return [
    `Thống kê hồ sơ — trạng thái: ${statusLabel}`,
    `Phạm vi: ${scopeClause.label}`,
    `Tổng: ${mem.total} hồ sơ`,
    "",
    "Theo tỉnh/thành phố:",
    ...mem.lines,
  ].join("\n");
}

async function scopeStatsMysql(
  label: string,
  where: string,
  params: string[],
  sampleLimit = 25,
): Promise<string[]> {
  const statusRows = await queryRows<
    (RowDataPacket & { military_status: string; cnt: number })[]
  >(
    `SELECT military_status, COUNT(*) AS cnt
     FROM citizens WHERE ${where}
     GROUP BY military_status`,
    params,
  );

  const [totalRow] = await queryRows<(RowDataPacket & { cnt: number })[]>(
    `SELECT COUNT(*) AS cnt FROM citizens WHERE ${where}`,
    params,
  );

  const sample = await queryRows<
    (RowDataPacket & {
      full_name: string;
      cccd: string;
      military_status: string;
      health_grade: number | null;
      military_status_reason: string | null;
      unit_code: string | null;
    })[]
  >(
    `SELECT full_name, cccd, military_status, health_grade,
            military_status_reason, unit_code
     FROM citizens
     WHERE ${where}
     ORDER BY updated_at DESC
     LIMIT ?`,
    [...params, sampleLimit],
  );

  return [
    `### ${label}`,
    `Tổng hồ sơ: ${Number(totalRow?.cnt || 0)}`,
    "Phân bố trạng thái NVQS:",
    ...statusRows.map(
      (r) =>
        `- ${STATUS_LABELS[r.military_status] || r.military_status}: ${r.cnt}`,
    ),
    `Mẫu hồ sơ (tối đa ${sampleLimit}):`,
    ...sample.map(
      (c) =>
        `- ${c.full_name} — CCCD ${c.cccd} — ${STATUS_LABELS[c.military_status] || c.military_status}` +
        `${c.health_grade != null ? ` — SK Loại ${c.health_grade}` : ""}` +
        `${c.military_status_reason ? ` — ${c.military_status_reason}` : ""}` +
        `${c.unit_code ? ` — ĐV ${c.unit_code}` : ""}`,
    ),
  ];
}

/** Gom ngữ cảnh theo câu hỏi + cấp đơn vị đăng nhập */
export async function buildChatKnowledgeContext(
  scope: SessionScope,
  question = "",
): Promise<{ text: string; source: "mysql" | "memory"; focus: string[] }> {
  const detected = detectProvincesInQuestion(question);
  const citizenIntent = detectCitizenQueryIntent(question);
  const dbOk = await pingDb();

  if (dbOk) {
    try {
      const parts: string[] = [
        `Người dùng: ${scope.name} | Cấp: ${scope.hierarchyLevel} | Đơn vị: ${scope.unitCode}`,
      ];

      // Câu hỏi thống kê theo trạng thái → chỉ số hồ sơ, không liệt kê từng người
      if (citizenIntent) {
        parts.push(
          "Quy tắc: Chỉ trả lời SỐ HỒ SƠ (tổng và theo tỉnh/TP). Không liệt kê tên/CCCD từng công dân.",
        );
        parts.push(...(await nationalStatusBreakdownMysql()));
        parts.push(
          ...(await statusByProvinceMysql(
            citizenIntent.statuses,
            scope,
            detected,
          )),
        );

        return {
          text: parts.join("\n"),
          source: "mysql",
          focus: detected.map((d) => d.name),
        };
      }

      parts.push(
        "Quy tắc: Cấp Bộ xem được toàn quốc. Khi hỏi 1 tỉnh/TP, dùng đúng số liệu mục chi tiết tỉnh đó bên dưới.",
      );
      parts.push(...(await nationalStatusBreakdownMysql()));

      if (scope.hierarchyLevel === "bo") {
        const [national] = await queryRows<(RowDataPacket & { cnt: number })[]>(
          "SELECT COUNT(*) AS cnt FROM citizens",
        );
        parts.push(`Tổng hồ sơ toàn quốc: ${Number(national?.cnt || 0)}`);
        parts.push("Thống kê theo từng tỉnh/thành phố:");
        parts.push(...(await provinceTotalsMysql()));
      } else {
        const where =
          "(unit_code = ? OR unit_code LIKE CONCAT(?, '-%'))";
        const params = [scope.unitCode, scope.unitCode];
        const unitName =
          hierarchyUnits.find((u) => u.code === scope.unitCode)?.name ||
          scope.unitCode;
        parts.push(
          ...(await scopeStatsMysql(`Phạm vi đơn vị: ${unitName}`, where, params, 100)),
        );
      }

      // Câu hỏi nhắc tỉnh cụ thể → nạp chi tiết tỉnh đó (ưu tiên cho cấp Bộ)
      const targets =
        detected.length > 0
          ? detected
          : scope.hierarchyLevel !== "bo"
            ? []
            : [];

      for (const p of targets) {
        // Cấp dưới chỉ được xem tỉnh trong phạm vi
        if (scope.hierarchyLevel !== "bo") {
          const allowed = new Set(getUnitDescendants(scope.unitCode));
          if (
            !allowed.has(p.code) &&
            !Array.from(allowed).some((c) => c.startsWith(`${p.code}-`))
          ) {
            parts.push(
              `### ${p.name}: không thuộc phạm vi đơn vị đăng nhập — không được xem.`,
            );
            continue;
          }
        }

        const where = "(unit_code = ? OR unit_code LIKE CONCAT(?, '-%'))";
        parts.push(
          ...(await scopeStatsMysql(
            `Chi tiết tỉnh/TP được hỏi: ${p.name} (mã ${p.code})`,
            where,
            [p.code, p.code],
            40,
          )),
        );
      }

      if (scope.hierarchyLevel === "bo" && detected.length === 0 && question) {
        parts.push(
          "Gợi ý: nếu người dùng hỏi 1 thành phố cụ thể, hãy tra trong bảng thống kê theo tỉnh/TP ở trên (đã có đủ 34 đơn vị).",
        );
      }

      if (!question || questionNeedsLegalContext(question)) {
        parts.push(buildLegalKnowledgeForAi());
      }

      return {
        text: parts.join("\n"),
        source: "mysql",
        focus: detected.map((d) => d.name),
      };
    } catch (e) {
      console.error("buildChatKnowledgeContext mysql:", e);
    }
  }

  // Fallback memory
  const provinces = loadProvinces();
  const all = db.citizens.findAll({ limit: 10000 }).data;

  if (citizenIntent) {
    const statusCounts: Record<string, number> = {};
    for (const c of all) {
      statusCounts[c.militaryStatus] = (statusCounts[c.militaryStatus] || 0) + 1;
    }
    const mem = statusByProvinceMemory(citizenIntent.statuses, scope, detected);

    const parts = [
      `Nguồn: demo in-memory | Cấp ${scope.hierarchyLevel}`,
      "Quy tắc: Chỉ trả lời số hồ sơ, không liệt kê tên từng người.",
      "### Phân bố trạng thái NVQS",
      ...Object.entries(statusCounts).map(
        ([s, n]) => `- ${STATUS_LABELS[s] || s}: ${n}`,
      ),
      `Tổng theo trạng thái hỏi: ${mem.total} hồ sơ`,
      "Theo tỉnh/TP:",
      ...mem.lines,
    ];

    return {
      text: parts.join("\n"),
      source: "memory",
      focus: detected.map((d) => d.name),
    };
  }

  const byTinh: Record<string, number> = {};
  for (const c of all) {
    const tinh = c.unitCode?.split("-")[0] || "unknown";
    byTinh[tinh] = (byTinh[tinh] || 0) + 1;
  }
  const nameByCode = Object.fromEntries(provinces.map((p) => [p.code, p.name]));

  const parts = [
    `Nguồn: demo in-memory | Cấp ${scope.hierarchyLevel}`,
    `Tổng hồ sơ: ${all.length}`,
    "Theo tỉnh/TP:",
    ...Object.entries(byTinh).map(
      ([code, cnt]) => `- ${nameByCode[code] || code}: ${cnt} hồ sơ`,
    ),
  ];

  for (const p of detected) {
    const list = all.filter(
      (c) => c.unitCode === p.code || c.unitCode?.startsWith(`${p.code}-`),
    );
    parts.push(`### Chi tiết ${p.name}: ${list.length} hồ sơ`);
    parts.push(
      ...list.slice(0, 40).map(
        (c) =>
          `- ${c.fullName} — ${c.cccd} — ${STATUS_LABELS[c.militaryStatus] || c.militaryStatus}`,
      ),
    );
  }

  if (!question || questionNeedsLegalContext(question)) {
    parts.push(buildLegalKnowledgeForAi());
  }

  return {
    text: parts.join("\n"),
    source: "memory",
    focus: detected.map((d) => d.name),
  };
}
