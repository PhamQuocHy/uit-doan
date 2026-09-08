"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, Loader2, Nfc, Unplug } from "lucide-react";
import { GhostButton, MobileCard, MobileShell, PrimaryButton } from "@/components/mobile/MobileShell";
import {
  clearStoredSession,
  disconnectSession,
  loadStoredSession,
  ocrOnServer,
  requestScanId,
  submitScanResult,
  type StoredMobileSession,
} from "@/lib/mobile/client";
import { NativeIdCard, NFC, isNativeIos } from "@/lib/native/nfc";
import { compressImageFile } from "@/lib/native/web-capture";
import type { CitizenNFCData, OcrFieldResult } from "@/lib/native/types";
import { compareNfcAndOcr } from "@/lib/mobile/verify";
import type { CitizenData } from "@/lib/mobile/types";

type Phase =
  | "home"
  | "nfc"
  | "camera-front"
  | "camera-back"
  | "processing"
  | "need-can";

function mergeOcr(front?: OcrFieldResult, back?: OcrFieldResult): CitizenData {
  const pick = (key: keyof CitizenData) =>
    (front?.[key] || back?.[key] || "").trim();
  return {
    fullName: pick("fullName"),
    personalId: pick("personalId"),
    dateOfBirth: pick("dateOfBirth"),
    gender: pick("gender"),
    nationality: pick("nationality") || "Việt Nam",
    placeOfOrigin: pick("placeOfOrigin"),
    placeOfResidence: pick("placeOfResidence"),
  };
}

export default function MobileScanPage() {
  const router = useRouter();
  const [stored, setStored] = useState<StoredMobileSession | null>(null);
  const [phase, setPhase] = useState<Phase>("home");
  const [message, setMessage] = useState("");
  const [can, setCan] = useState("");
  const [nfcData, setNfcData] = useState<Partial<CitizenData>>({});
  const [ocrFront, setOcrFront] = useState<OcrFieldResult | undefined>();
  const [ocrBack, setOcrBack] = useState<OcrFieldResult | undefined>();
  const [steps, setSteps] = useState({
    nfc: false,
    ocrFront: false,
    ocrBack: false,
    verify: false,
  });

  useEffect(() => {
    const s = loadStoredSession();
    if (!s) {
      router.replace("/mobile/connect");
      return;
    }
    setStored(s);
  }, [router]);

  const native = useMemo(() => isNativeIos(), []);
  const fileRef = useRef<HTMLInputElement>(null);
  const pendingSide = useRef<"front" | "back">("front");

  async function handleDisconnect() {
    if (stored) await disconnectSession(stored);
    else clearStoredSession();
    router.replace("/mobile/connect");
  }

  async function runNfc(optionalCan?: string) {
    if (!native) {
      setMessage("Safari không đọc được chip CCCD. Trên Windows chưa cài được app iOS — NFC chỉ chạy khi build bằng Xcode trên Mac.");
      return;
    }
    setPhase("nfc");
    setMessage("Đưa CCCD gắn chip lại gần mặt lưng iPhone");
    const result = await NFC.scan({
      can: optionalCan || can || ocrBack?.can,
      mrz: ocrBack?.mrz,
    });
    if (!result.success) {
      if (result.errorCode === "NEED_CAN") {
        setPhase("need-can");
        setMessage("CCCD yêu cầu mã CAN (6 số in ở mặt sau) để xác thực chip.");
        return;
      }
      setPhase("home");
      setMessage(result.error || "Không đọc được NFC");
      return;
    }
    const data = result.data as CitizenNFCData;
    setNfcData({
      fullName: data.fullName,
      personalId: data.personalId,
      dateOfBirth: data.dateOfBirth,
      gender: data.gender,
      nationality: data.nationality,
      placeOfOrigin: data.placeOfOrigin,
      placeOfResidence: data.placeOfResidence,
    });
    setSteps((s) => ({ ...s, nfc: true }));
    setPhase("home");
    setMessage("✓ Đã đọc NFC");
  }

  async function processImage(side: "front" | "back", imageBase64: string) {
    if (!stored) return;
    let ocr: { success?: boolean; data?: OcrFieldResult; error?: string };
    if (native) {
      ocr = await NativeIdCard.ocr(imageBase64, side);
      void NativeIdCard.clearTemp();
    } else {
      ocr = await ocrOnServer(stored, imageBase64, side);
    }
    if (!ocr.success || !ocr.data) {
      setPhase("home");
      setMessage(ocr.error || "OCR thất bại");
      return;
    }
    if (side === "front") {
      setOcrFront(ocr.data);
      setSteps((s) => ({ ...s, ocrFront: true }));
    } else {
      setOcrBack(ocr.data);
      setSteps((s) => ({ ...s, ocrBack: true }));
      if (ocr.data.can) setCan(ocr.data.can);
    }
    setPhase("home");
    setMessage(side === "front" ? "✓ Đã OCR mặt trước" : "✓ Đã OCR mặt sau");
  }

  async function captureSide(side: "front" | "back") {
    if (!native) {
      pendingSide.current = side;
      fileRef.current?.click();
      return;
    }
    setPhase(side === "front" ? "camera-front" : "camera-back");
    setMessage(side === "front" ? "Chụp mặt trước CCCD" : "Chụp mặt sau CCCD");
    const captured = await NativeIdCard.capture(side);
    if (!captured.success || !captured.imageBase64) {
      setPhase("home");
      setMessage(captured.error || "Không chụp được ảnh");
      return;
    }
    await processImage(side, captured.imageBase64);
  }

  async function onWebPhoto(file: File | undefined) {
    if (!file || !stored) return;
    const side = pendingSide.current;
    setPhase(side === "front" ? "camera-front" : "camera-back");
    const captured = await compressImageFile(file);
    if (!captured.success || !captured.imageBase64) {
      setPhase("home");
      setMessage(captured.error || "Không chụp được ảnh");
      return;
    }
    try {
      await processImage(side, captured.imageBase64);
    } catch (error) {
      setPhase("home");
      setMessage(error instanceof Error ? error.message : "OCR thất bại");
    }
  }

  async function finishAndSend() {
    if (!stored) return;
    setPhase("processing");
    const ocr = mergeOcr(ocrFront, ocrBack);
    const verification = compareNfcAndOcr(nfcData, ocr);
    setSteps((s) => ({ ...s, verify: true }));
    try {
      const scanId = await requestScanId(stored);
      await submitScanResult({
        stored,
        scanId,
        nfc: nfcData,
        ocr,
        verification,
      });
      sessionStorage.setItem(
        "nvqs.mobile.lastResult",
        JSON.stringify({ nfc: nfcData, ocr, verification }),
      );
      router.push("/mobile/result");
    } catch (error) {
      setPhase("home");
      setMessage(error instanceof Error ? error.message : "Gửi kết quả thất bại");
    }
  }

  if (!stored) return null;

  return (
    <MobileShell>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          void onWebPhoto(file);
        }}
      />
      {phase === "home" && (
        <MobileCard>
          <div className="text-center space-y-1">
            <p className="text-m3-on-success-container font-semibold">✓ Đã kết nối</p>
            <p className="text-sm text-m3-on-surface-variant">
              Phiên: <span className="font-mono tracking-widest">{stored.connectionCode}</span>
            </p>
            {!native && (
              <p className="text-xs text-m3-on-warning-container bg-m3-warning-container rounded-xl p-2">
                Đang chạy bằng Safari. Có thể kết nối phiên và chụp CCCD. Đọc chip NFC cần app cài từ Xcode (máy Mac).
              </p>
            )}
          </div>

          {message && <p className="text-sm text-center text-m3-on-surface-variant">{message}</p>}

          <PrimaryButton onClick={() => void runNfc()}>
            <span className="inline-flex items-center gap-2">
              <Nfc size={18} /> Quét NFC
            </span>
          </PrimaryButton>
          <PrimaryButton onClick={() => void captureSide("front")}>
            <span className="inline-flex items-center gap-2">
              <Camera size={18} /> Chụp CCCD
            </span>
          </PrimaryButton>
          {steps.ocrFront && !steps.ocrBack && (
            <PrimaryButton onClick={() => void captureSide("back")}>
              Chụp mặt sau CCCD
            </PrimaryButton>
          )}
          {steps.ocrFront && steps.ocrBack && (
            <PrimaryButton onClick={() => void finishAndSend()}>Đối chiếu và gửi</PrimaryButton>
          )}
          <GhostButton onClick={() => void handleDisconnect()}>
            <span className="inline-flex items-center gap-2 justify-center">
              <Unplug size={16} /> Hủy kết nối
            </span>
          </GhostButton>
        </MobileCard>
      )}

      {phase === "nfc" && (
        <MobileCard>
          <p className="text-center font-semibold" style={{ color: "var(--m3-on-surface, #1b1d20)" }}>
            Đưa CCCD gắn chip lại gần mặt lưng iPhone
          </p>
          <div className="flex justify-center py-8">
            <Loader2 size={56} className="animate-spin" style={{ color: "var(--m3-primary, #1a73e8)" }} />
          </div>
          <p className="text-center text-sm text-m3-on-surface-variant">Đang đọc NFC...</p>
        </MobileCard>
      )}

      {phase === "need-can" && (
        <MobileCard>
          <p className="font-semibold text-center" style={{ color: "var(--m3-on-surface, #1b1d20)" }}>
            Nhập CAN để mở chip CCCD
          </p>
          <p className="text-xs text-m3-on-surface-variant text-center">
            CAN là 6 số in trên mặt sau CCCD, dùng cho PACE — không phải số CCCD.
          </p>
          <input
            value={can}
            maxLength={6}
            inputMode="numeric"
            onChange={(e) => setCan(e.target.value.replace(/\D/g, ""))}
            className="w-full text-center text-2xl tracking-[0.4em] py-3 rounded-2xl border"
            style={{
              borderColor: "var(--m3-outline-variant, #e3e8ee)",
              background:
                can.length === 6
                  ? "var(--m3-surface-container-highest, #e4eaf2)"
                  : "var(--m3-surface-container-high, #eef1f4)",
            }}
          />
          <PrimaryButton onClick={() => void runNfc(can)} disabled={can.length !== 6}>
            Đọc chip với CAN
          </PrimaryButton>
          <GhostButton onClick={() => setPhase("home")}>Quay lại</GhostButton>
        </MobileCard>
      )}

      {(phase === "camera-front" || phase === "camera-back") && (
        <MobileCard>
          <p className="text-center font-semibold" style={{ color: "var(--m3-on-surface, #1b1d20)" }}>
            {phase === "camera-front" ? "Chụp mặt trước CCCD" : "Chụp mặt sau CCCD"}
          </p>
          <div
            className="mx-auto my-4 rounded-xl border-2 border-dashed"
            style={{
              width: "100%",
              maxWidth: 320,
              aspectRatio: "1.586",
              borderColor: "var(--m3-primary, #1a73e8)",
            }}
          />
          <p className="text-center text-sm text-m3-on-surface-variant">
            Căn thẻ trong khung. Ảnh sẽ được crop, nén và xóa khỏi máy sau khi OCR.
          </p>
          <div className="flex justify-center">
            <Loader2 className="animate-spin" style={{ color: "var(--m3-primary, #1a73e8)" }} />
          </div>
        </MobileCard>
      )}

      {phase === "processing" && (
        <MobileCard>
          <p className="font-semibold text-center" style={{ color: "var(--m3-on-surface, #1b1d20)" }}>
            Đang xử lý
          </p>
          <ul className="text-sm space-y-2">
            <li>{steps.nfc ? "✓ Đã đọc NFC" : "○ NFC"}</li>
            <li>{steps.ocrFront ? "✓ Đã OCR mặt trước" : "○ OCR mặt trước"}</li>
            <li>{steps.ocrBack ? "✓ Đã OCR mặt sau" : "○ OCR mặt sau"}</li>
            <li>⏳ Đang đối chiếu</li>
          </ul>
        </MobileCard>
      )}
    </MobileShell>
  );
}
