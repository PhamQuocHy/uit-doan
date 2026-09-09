import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db, hierarchyUnits } from "@/lib/data";
import { pingDb, queryRows } from "@/lib/db";
import { sqlAgeYear } from "@/lib/nvqs-age";
import { RETURN_TAM_HOAN_MARKER } from "@/lib/enlistment-approval";
import type { RowDataPacket } from "mysql2";

type NotiItem = {
  id: string;
  title: string;
  message: string;
  type: string;
  read: boolean;
  createdAt: string;
  href?: string;
};

function unitName(code: string | null | undefined): string {
  if (!code) return "—";
  return hierarchyUnits.find((u) => u.code === code)?.name || code;
}

/** Phạm vi hồ sơ: Bộ không quét toàn quốc — chỉ đơn vị đăng nhập (+ xã con nếu là tỉnh). */
function unitScopeSql(
  level: string,
  unitCode: string,
): { sql: string; params: string[] } | null {
  if (level === "bo") {
    // Cấp Bộ không nhận thông báo theo hồ sơ địa phương
    return null;
  }
  return {
    sql: "(c.unit_code = ? OR c.unit_code LIKE CONCAT(?, '-%'))",
    params: [unitCode, unitCode],
  };
}

function hrefForType(type: string, fallback?: string): string {
  if (fallback) return fallback;
  if (type.startsWith("quota")) return "/admin/quota";
  if (type.startsWith("document")) return "/admin/documents";
  if (type === "citizen_proposal_returned") return "/admin/citizens";
  if (type === "citizen_rejected") return "/admin/citizens?callIntent=khong_goi";
  if (type.startsWith("citizen_") || type === "approval_pending") {
    return "/admin/approval";
  }
  if (type === "archive_pending") return "/admin/citizen-archive";
  return "/admin";
}

async function buildSystemNotifications(
  level: string,
  unitCode: string,
): Promise<NotiItem[]> {
  if (!(await pingDb())) return [];

  const items: NotiItem[] = [];
  const now = new Date().toISOString();
  const scope = unitScopeSql(level, unitCode);

  try {
    // Hồ sơ / thanh niên: chỉ Tỉnh–Xã trong phạm vi quản lý (không cho Bộ thấy Cần Thơ…)
    if (scope) {
      const [approvalRow] = await queryRows<(RowDataPacket & { cnt: number })[]>(
        `SELECT COUNT(*) AS cnt FROM citizens c
         WHERE ${scope.sql}
           AND c.call_intent = 'du_kien_goi'
           AND c.approval_status = 'pending'
           AND c.archived_at IS NULL`,
        scope.params,
      );
      const pendingApproval = Number(approvalRow?.cnt || 0);
      if (pendingApproval > 0) {
        items.push({
          id: `sys-approval-pending-${unitCode}-${pendingApproval}`,
          title: "Hồ sơ chờ xét duyệt gọi",
          message: `Có ${pendingApproval.toLocaleString("vi-VN")} thanh niên thuộc phạm vi quản lý đang chờ xét duyệt.`,
          type: "approval_pending",
          read: false,
          createdAt: now,
          href: "/admin/approval",
        });
      }

      const recentCitizens = await queryRows<
        (RowDataPacket & {
          id: string;
          full_name: string;
          approval_status: string | null;
          call_intent: string | null;
          military_status: string | null;
          military_status_locked: number | null;
          military_status_reason: string | null;
          approval_comment: string | null;
          updated_at: string | Date;
        })[]
      >(
        `SELECT c.id, c.full_name, c.approval_status, c.call_intent,
                c.military_status, c.military_status_locked,
                c.military_status_reason, c.approval_comment, c.updated_at
         FROM citizens c
         WHERE ${scope.sql}
           AND c.archived_at IS NULL
           AND c.updated_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
           AND (
             c.approval_status IN ('approved','rejected')
             OR (
               IFNULL(c.approval_status,'none') = 'none'
               AND IFNULL(c.military_status_locked,0) = 1
               AND IFNULL(c.approval_comment,'') <> ''
             )
           )
         ORDER BY c.updated_at DESC
         LIMIT 20`,
        scope.params,
      );

      for (const row of recentCitizens) {
        const updatedAt = new Date(row.updated_at).toISOString();
        const status = row.approval_status || "none";
        const intent = row.call_intent || "unset";
        const locked = Number(row.military_status_locked) === 1;
        const comment = (row.approval_comment || "").trim();
        const reason = row.military_status_reason || "";
        const returned =
          status === "none" && locked && Boolean(comment);

        let title = "";
        let message = "";
        let type = "info";
        let href = "/admin/citizens";
        let kindKey = status;

        if (returned && reason === RETURN_TAM_HOAN_MARKER) {
          kindKey = "returned_tam_hoan";
          type = "citizen_proposal_returned";
          title = "Không duyệt tạm hoãn — trả về";
          message = `${row.full_name} bị Quân khu không duyệt tạm hoãn, đã chuyển về Hồ sơ mới (khóa). Lý do: ${comment}`;
          href = "/admin/citizens?callIntent=khong_duyet_tam_hoan";
        } else if (returned) {
          kindKey = "returned_khong_goi";
          type = "citizen_proposal_returned";
          title = "Không duyệt không gọi — trả về";
          message = `${row.full_name} bị Quân khu không duyệt đề xuất không gọi, đã chuyển về Hồ sơ mới (khóa). Lý do: ${comment}`;
          href = "/admin/citizens?callIntent=khong_duyet_khong_goi";
        } else if (status === "rejected") {
          kindKey = "rejected";
          type = "citizen_rejected";
          title = "Không duyệt gọi nhập ngũ";
          message = `${row.full_name} thuộc phạm vi quản lý của bạn đã bị đánh Không gọi${comment ? `: ${comment}` : reason ? `: ${reason}` : "."}`;
          href = "/admin/citizens?callIntent=khong_goi";
        } else if (
          status === "approved" &&
          (row.military_status === "nhapngu" || intent === "du_kien_goi")
        ) {
          kindKey = "approved_goi";
          type = "citizen_approved";
          title = "Thanh niên được duyệt gọi nhập ngũ";
          message = `${row.full_name} thuộc phạm vi quản lý của bạn đã được duyệt gọi nhập ngũ.`;
          href = "/admin/approval";
        } else if (status === "approved" && intent === "khong_goi") {
          kindKey = "approved_khong_goi";
          type = "citizen_approved";
          title = "Quân khu đồng tình không gọi";
          message = `${row.full_name}: đề xuất không gọi đã được Quân khu chấp thuận.`;
          href = "/admin/citizens?callIntent=khong_goi";
        } else if (status === "approved" && row.military_status === "tamhoan") {
          kindKey = "approved_tam_hoan";
          type = "citizen_approved";
          title = "Quân khu duyệt tạm hoãn";
          message = `${row.full_name}: hồ sơ tạm hoãn đã được Quân khu chấp thuận.`;
          href = "/admin/citizens";
        } else {
          continue;
        }

        items.push({
          id: `sys-citizen-${kindKey}-${row.id}-${updatedAt.slice(0, 13)}`,
          title,
          message,
          type,
          read: false,
          createdAt: updatedAt,
          href,
        });
      }

      const [archiveRow] = await queryRows<(RowDataPacket & { cnt: number })[]>(
        `SELECT COUNT(*) AS cnt FROM citizens c
         WHERE ${scope.sql}
           AND c.archived_at IS NULL
           AND ${sqlAgeYear("c.date_of_birth")} > 27`,
        scope.params,
      );
      const pendingArchive = Number(archiveRow?.cnt || 0);
      if (pendingArchive > 0) {
        items.push({
          id: `sys-archive-pending-${unitCode}-${pendingArchive}`,
          title: "Hồ sơ hết tuổi chờ lưu trữ",
          message: `Có ${pendingArchive.toLocaleString("vi-VN")} hồ sơ hết tuổi NVQS cần duyệt chuyển lưu trữ.`,
          type: "archive_pending",
          read: false,
          createdAt: now,
          href: "/admin/citizen-archive",
        });
      }
    }

    // Công văn đến: chỉ đơn vị nằm trong to_units (đúng người nhận)
    const incomingDocs = await queryRows<
      (RowDataPacket & {
        id: string;
        title: string;
        from_unit: string;
        urgent: number;
        created_at: string | Date;
      })[]
    >(
      `SELECT id, title, from_unit, urgent, created_at
       FROM official_documents
       WHERE JSON_CONTAINS(to_units_json, JSON_QUOTE(?), '$')
         AND from_unit <> ?
         AND created_at >= DATE_SUB(NOW(), INTERVAL 14 DAY)
       ORDER BY urgent DESC, created_at DESC
       LIMIT 10`,
      [unitCode, unitCode],
    );
    for (const doc of incomingDocs) {
      const createdAt = new Date(doc.created_at).toISOString();
      items.push({
        id: `sys-doc-in-${doc.id}`,
        title: doc.urgent ? "Công văn đến (khẩn)" : "Công văn đến",
        message: `${unitName(doc.from_unit)} gửi: ${doc.title}`,
        type: "document_incoming",
        read: false,
        createdAt,
        href: "/admin/documents",
      });
    }

    // Công văn đi: chỉ đơn vị gửi
    const outgoingDocs = await queryRows<
      (RowDataPacket & {
        id: string;
        title: string;
        urgent: number;
        created_at: string | Date;
        to_units_json: unknown;
      })[]
    >(
      `SELECT id, title, urgent, created_at, to_units_json
       FROM official_documents
       WHERE from_unit = ?
         AND created_at >= DATE_SUB(NOW(), INTERVAL 14 DAY)
       ORDER BY created_at DESC
       LIMIT 5`,
      [unitCode],
    );
    for (const doc of outgoingDocs) {
      const createdAt = new Date(doc.created_at).toISOString();
      let recipients = "";
      try {
        const raw =
          typeof doc.to_units_json === "string"
            ? JSON.parse(doc.to_units_json)
            : doc.to_units_json;
        const codes = Array.isArray(raw) ? raw.map(String) : [];
        recipients = codes.map(unitName).slice(0, 3).join(", ");
        if (codes.length > 3) recipients += ` (+${codes.length - 3})`;
      } catch {
        recipients = "các đơn vị nhận";
      }
      items.push({
        id: `sys-doc-out-${doc.id}`,
        title: doc.urgent ? "Công văn đi (khẩn)" : "Công văn đi",
        message: `Đã gửi “${doc.title}” tới ${recipients || "đơn vị nhận"}.`,
        type: "document_outgoing",
        read: false,
        createdAt,
        href: "/admin/documents",
      });
    }
  } catch (e) {
    console.error("buildSystemNotifications:", e);
  }

  return items;
}

/**
 * Chỉ thông báo gửi đúng `toUnit` = đơn vị đăng nhập.
 * Không để cấp Bộ / Tỉnh “nhìn trộm” chỉ tiêu đã giao cho đơn vị khác.
 */
function findMemoryNotifications(unitCode: string): NotiItem[] {
  return db.notifications.findForUnit(unitCode).map((n) => ({
    id: n.id,
    title: n.title,
    message: n.message,
    type: n.type,
    read: n.read,
    createdAt: n.createdAt,
    href: hrefForType(n.type, n.relatedHref),
  }));
}

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const system = await buildSystemNotifications(
    session.hierarchyLevel,
    session.unitCode,
  );
  const memory = findMemoryNotifications(session.unitCode);

  const seen = new Set<string>();
  const data = [...memory, ...system]
    .sort((a, b) => {
      const tb = Date.parse(b.createdAt) || 0;
      const ta = Date.parse(a.createdAt) || 0;
      if (tb !== ta) return tb - ta;
      return String(b.id).localeCompare(String(a.id));
    })
    .filter((n) => {
      if (seen.has(n.id)) return false;
      seen.add(n.id);
      return true;
    });
  const unread = data.filter((n) => !n.read).length;

  return NextResponse.json({ data, unread });
}

export async function PATCH(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  if (body.all === true) {
    db.notifications.markAllRead(session.unitCode);
    return NextResponse.json({ ok: true });
  }

  if (body.id) {
    const id = String(body.id);
    if (id.startsWith("sys-")) {
      return NextResponse.json({ ok: true, data: { id, read: true } });
    }
    const n = db.notifications.markRead(id, session.unitCode);
    if (!n) {
      return NextResponse.json({ error: "Không tìm thấy thông báo" }, { status: 404 });
    }
    return NextResponse.json({ data: n });
  }

  return NextResponse.json({ error: "Thiếu tham số" }, { status: 400 });
}
