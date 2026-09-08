import { Capacitor, registerPlugin } from "@capacitor/core";
import type { CaptureResult, NFCResult, OcrResult } from "./types";

export interface CccdNativePlugin {
  scanNfc(options: { can?: string; mrz?: string }): Promise<NFCResult>;
  captureIdCard(options: { side: "front" | "back" }): Promise<CaptureResult>;
  ocrIdCard(options: {
    imageBase64: string;
    side: "front" | "back";
  }): Promise<OcrResult>;
  clearTempImages(): Promise<{ ok: boolean }>;
}

const CccdNative = registerPlugin<CccdNativePlugin>("CccdNative");

export function isNativeIos(): boolean {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === "ios";
}

function nativeOnly(message: string, code = "NFC_NATIVE_ONLY"): NFCResult {
  return { success: false, error: message, errorCode: code };
}

export const NFC = {
  async scan(options?: { can?: string; mrz?: string }): Promise<NFCResult> {
    if (!Capacitor.isNativePlatform()) {
      return nativeOnly(
        "NFC chỉ chạy trên app iOS native qua Apple Core NFC. Không dùng Web NFC.",
      );
    }
    try {
      return await CccdNative.scanNfc(options ?? {});
    } catch (error) {
      return nativeOnly(
        error instanceof Error ? error.message : "NFC plugin chưa được gắn vào Xcode",
      );
    }
  },
};

export const NativeIdCard = {
  async capture(side: "front" | "back"): Promise<CaptureResult> {
    try {
      return await CccdNative.captureIdCard({ side });
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Camera native chưa sẵn sàng",
      };
    }
  },
  async ocr(imageBase64: string, side: "front" | "back"): Promise<OcrResult> {
    try {
      return await CccdNative.ocrIdCard({ imageBase64, side });
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "OCR Vision chưa sẵn sàng",
      };
    }
  },
  async clearTemp(): Promise<{ ok: boolean }> {
    try {
      return await CccdNative.clearTempImages();
    } catch {
      return { ok: true };
    }
  },
};

export { CccdNative };
