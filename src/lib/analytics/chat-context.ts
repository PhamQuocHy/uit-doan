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
  const dbOk = await pingDb();

  if (dbOk) {
    try {
      const parts: string[] = [
        `Người dùng: ${scope.name} | Cấp: ${scope.hierarchyLevel} | Đơn vị: ${scope.unitCode}`,
        "Quy tắc: Cấp Bộ xem được toàn quốc. Khi hỏi 1 tỉnh/TP, dùng đúng số liệu mục chi tiết tỉnh đó bên dưới.",
      ];

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
          ...(await scopeStatsMysql(`Phạm vi đơn vị: ${unitName}`, where, params)),
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
