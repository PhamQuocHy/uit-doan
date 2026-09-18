import { createHash } from "node:crypto";
import type { RowDataPacket } from "mysql2";
import { queryExecute, queryRows } from "@/lib/db";
import { assessHumanCheck, type HumanCheckInput } from "@/lib/human-check";

type Recipient = { userId: string; unitCode: string };
type Suggestion = HumanCheckInput & { citizenId: string; fullName?: string; label: string };

export async function notifyHumanChecks<T extends Suggestion>(
  recipient: Recipient, items: T[], context: string, href: string, requireGemini = false,
) {
  const reviewed = items.map(item => ({ ...item, humanCheck: assessHumanCheck(item, requireGemini) }));
  for (const item of reviewed) {
    if (!item.humanCheck.required) continue;
    const title = "Human Check: cần kiểm tra gợi ý AI";
    const message = `${item.fullName || item.citizenId} — ${item.label}. ${item.humanCheck.reasons.join(" ")} Hãy đối chiếu hồ sơ và minh chứng trước khi quyết định.`.slice(0, 4000);
    // Repeat requests for the same result do not flood the bell or reset read status.
    const id = createHash("sha256").update(JSON.stringify([recipient.userId, recipient.unitCode, context, item.citizenId, message])).digest("hex");
    const target = href === "/admin/citizens" && item.fullName
      ? `${href}?search=${encodeURIComponent(item.fullName)}` : href;
    await queryExecute(`INSERT INTO human_check_notifications (id, user_id, unit_code, title, message, href)
      VALUES (?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE id = id`,
    [id, recipient.userId, recipient.unitCode, title, message, target]);
  }
  return reviewed;
}

export async function listHumanCheckNotifications(recipient: Recipient) {
  const rows = await queryRows<(RowDataPacket & { id: string; title: string; message: string; href: string; read_at: unknown; created_at: Date })[]>(
    `SELECT id, title, message, href, read_at, created_at FROM human_check_notifications
     WHERE user_id = ? AND unit_code = ? ORDER BY (read_at IS NULL) DESC, created_at DESC LIMIT 100`,
    [recipient.userId, recipient.unitCode]);
  return rows.map(row => ({ id: `hc-${row.id}`, title: row.title, message: row.message, href: row.href,
    type: "human_check", read: !!row.read_at, createdAt: new Date(row.created_at).toISOString() }));
}

export async function readHumanCheckNotifications(recipient: Recipient, id?: string) {
  const result = await queryExecute(`UPDATE human_check_notifications SET read_at = COALESCE(read_at, NOW())
    WHERE user_id = ? AND unit_code = ?${id ? " AND id = ?" : ""}`,
  [recipient.userId, recipient.unitCode, ...(id ? [id.replace(/^hc-/, "")] : [])]);
  return result.affectedRows > 0;
}
