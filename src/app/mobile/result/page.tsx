"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, XCircle } from "lucide-react";
import { GhostButton, MobileCard, MobileShell, PrimaryButton } from "@/components/mobile/MobileShell";
import type { CitizenData, VerificationResult } from "@/lib/mobile/types";
import { clearStoredSession } from "@/lib/mobile/client";

type StoredResult = {
  nfc: Partial<CitizenData>;
  ocr: Partial<CitizenData>;
  verification: VerificationResult;
};

export default function MobileResultPage() {
  const router = useRouter();
  const [data, setData] = useState<StoredResult | null>(null);

  useEffect(() => {
    const raw = sessionStorage.getItem("nvqs.mobile.lastResult");
    if (!raw) {
      router.replace("/mobile/connect");
      return;
    }
    setData(JSON.parse(raw) as StoredResult);
  }, [router]);

  if (!data) return null;

  const view = {
    fullName: data.nfc.fullName || data.ocr.fullName || "",
    dateOfBirth: data.nfc.dateOfBirth || data.ocr.dateOfBirth || "",
    personalId: data.nfc.personalId || data.ocr.personalId || "",
    gender: data.nfc.gender || data.ocr.gender || "",
  };
  const ok = data.verification.matched;

  return (
    <MobileShell>
      <MobileCard>
        <div className="text-center space-y-2">
          {ok ? (
            <CheckCircle2 size={48} className="mx-auto text-m3-on-success-container" />
          ) : (
            <XCircle size={48} className="mx-auto text-m3-on-warning-container" />
          )}
          <p className="font-bold text-lg" style={{ color: "var(--m3-on-surface, #1b1d20)" }}>
            {ok ? "✓ Xác thực thành công" : "Đối chiếu chưa khớp"}
          </p>
        </div>

        <div className="space-y-2 text-sm">
          {[
            ["Họ tên", view.fullName],
            ["Ngày sinh", view.dateOfBirth],
            ["Số định danh", view.personalId],
            ["Giới tính", view.gender],
          ].map(([label, value]) => (
            <div key={label} className="flex justify-between gap-3 border-b border-m3-outline-variant py-2">
              <span className="text-m3-on-surface-variant">{label}</span>
              <span className="font-medium text-right">{value || "—"}</span>
            </div>
          ))}
        </div>

        <div className="text-sm space-y-1">
          <p>NFC {data.nfc.personalId ? "✓" : "○"}</p>
          <p>OCR {data.ocr.personalId || data.ocr.fullName ? "✓" : "○"}</p>
          <p>Đối chiếu {ok ? "✓" : "○"}</p>
        </div>

        {!ok && data.verification.mismatches.length > 0 && (
          <div className="text-xs bg-m3-warning-container text-m3-on-warning-container rounded-xl p-3 space-y-1">
            {data.verification.mismatches.map((m) => (
              <p key={m.field}>
                {m.field}: NFC “{m.nfc}” / OCR “{m.ocr}”
              </p>
            ))}
          </div>
        )}

        <PrimaryButton
          onClick={() => {
            sessionStorage.removeItem("nvqs.mobile.lastResult");
            router.push("/mobile/scan");
          }}
        >
          Hoàn tất
        </PrimaryButton>
        <GhostButton
          onClick={() => {
            sessionStorage.removeItem("nvqs.mobile.lastResult");
            clearStoredSession();
            router.replace("/mobile/connect");
          }}
        >
          Phiên mới
        </GhostButton>
      </MobileCard>
    </MobileShell>
  );
}
