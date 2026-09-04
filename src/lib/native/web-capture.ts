import type { CaptureResult } from "@/lib/native/types";

export async function compressImageFile(file: File, maxWidth = 1280): Promise<CaptureResult> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxWidth / Math.max(bitmap.width, 1));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return { success: false, error: "Không xử lý được ảnh" };
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob((b) => resolve(b), "image/jpeg", 0.7),
  );
  if (!blob) return { success: false, error: "Nén ảnh thất bại" };
  if (blob.size > 1_200_000) {
    const tighter = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((b) => resolve(b), "image/jpeg", 0.5),
    );
    if (tighter) {
      const buf = await tighter.arrayBuffer();
      return {
        success: true,
        imageBase64: arrayBufferToBase64(buf),
        mimeType: "image/jpeg",
        qualityScore: width >= 600 ? 0.7 : 0.3,
      };
    }
  }

  const buf = await blob.arrayBuffer();
  return {
    success: true,
    imageBase64: arrayBufferToBase64(buf),
    mimeType: "image/jpeg",
    qualityScore: width >= 600 ? 0.75 : 0.3,
  };
}

function arrayBufferToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}
