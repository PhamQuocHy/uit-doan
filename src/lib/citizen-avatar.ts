/** Client-safe helpers for citizen portrait (ảnh 3×4). */

/** Chuẩn hóa URL hiển thị ảnh (file path / data URL / base64 chip / http). */
export function resolveCitizenAvatarSrc(
  avatar: string | null | undefined,
  fullName?: string,
): string {
  const raw = (avatar || "").trim();
  if (!raw) {
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(fullName || "?")}&background=007aff&color=fff&size=128&font-size=0.33`;
  }
  if (
    raw.startsWith("data:") ||
    raw.startsWith("http://") ||
    raw.startsWith("https://") ||
    raw.startsWith("blob:")
  ) {
    return raw;
  }
  if (raw.startsWith("/uploads/") || raw.startsWith("uploads/")) {
    return raw.startsWith("/") ? raw : `/${raw}`;
  }
  // Legacy: ảnh chip lưu base64 thuần
  return `data:image/jpeg;base64,${raw}`;
}

export function isDiskAvatarPath(avatar: string | null | undefined): boolean {
  const raw = (avatar || "").trim();
  return (
    raw.startsWith("/uploads/avatars/") ||
    raw.startsWith("uploads/avatars/")
  );
}
