/** Chuẩn ngày lịch (không giờ) — tránh lệch timezone khi lưu/hiển thị. */

/** yyyy-MM-dd → dd/mm/yyyy */
export function isoToVn(iso: string): string {
  const s = iso.trim().slice(0, 10);
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return "";
  return `${m[3]}/${m[2]}/${m[1]}`;
}

/** dd/mm/yyyy hoặc d/m/yyyy → yyyy-MM-dd */
export function vnToIso(vn: string): string {
  const s = vn.trim();
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return "";
  const dd = m[1]!.padStart(2, "0");
  const mm = m[2]!.padStart(2, "0");
  const yyyy = m[3]!;
  const d = Number(dd);
  const mo = Number(mm);
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return "";
  return `${yyyy}-${mm}-${dd}`;
}

export function maskVnDateInput(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

/** Hiển thị dd/mm/yyyy từ giá trị DB (string/Date), không dùng Date→ISO. */
export function formatVnDate(
  value: string | Date | null | undefined,
): string {
  const iso = toDateOnlyString(value);
  return iso ? isoToVn(iso) : "";
}

/**
 * Lấy yyyy-MM-dd từ DATE MySQL / ISO / Date.
 * Không dùng toISOString().slice — tránh trừ 1 ngày (UTC+7).
 */
export function toDateOnlyString(
  d: string | Date | null | undefined,
): string | undefined {
  if (d == null || d === "") return undefined;

  if (typeof d === "string") {
    const m = /^(\d{4}-\d{2}-\d{2})/.exec(d.trim());
    if (m) return m[1];
    return undefined;
  }

  if (d instanceof Date && !Number.isNaN(d.getTime())) {
    // mysql2 DATE → Date local midnight; lấy lịch địa phương
    const y = d.getFullYear();
    const mo = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${mo}-${day}`;
  }

  return undefined;
}
