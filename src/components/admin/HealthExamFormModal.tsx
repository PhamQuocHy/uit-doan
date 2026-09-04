"use client";

import { useState, FormEvent } from "react";
import { X, Loader2 } from "lucide-react";
import type { HealthExamPhase, HealthRecord } from "@/lib/data";
import {
  HEALTH_CONCLUSIONS,
  defaultFacilityForRound,
  resolveDetailedPhase,
  type HealthExamRound,
} from "@/lib/health-exam";

type Props = {
  citizenId: string;
  citizenName: string;
  round: HealthExamRound;
  hierarchyLevel: string;
  year: number;
  onClose: () => void;
  onSaved: (record: HealthRecord) => void;
};

const inputCls =
  "w-full rounded-[12px] border border-black/[0.08] bg-m3-surface-lowest px-3.5 py-2.5 text-[14px] text-m3-on-surface outline-none focus:border-m3-primary/40 focus:ring-2 focus:ring-m3-primary/15";

const labelCls = "mb-1 block text-[13px] font-medium text-m3-on-surface-variant";

export default function HealthExamFormModal({
  citizenId,
  citizenName,
  round,
  hierarchyLevel,
  year,
  onClose,
  onSaved,
}: Props) {
  const isScreening = round === "screening";
  const phase: HealthExamPhase = isScreening
    ? "Sơ tuyển cấp xã"
    : resolveDetailedPhase(hierarchyLevel);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [facility, setFacility] = useState(
    defaultFacilityForRound(round, hierarchyLevel),
  );
  const [height, setHeight] = useState("");
  const [weight, setWeight] = useState("");
  const [bloodPressure, setBloodPressure] = useState("");
  const [vision, setVision] = useState("");
  const [conclusion, setConclusion] = useState<string>("Loại 1");
  const [doctor, setDoctor] = useState("");
  const [note, setNote] = useState("");
  const [physicalDefects, setPhysicalDefects] = useState("");

  const [chestCircumference, setChestCircumference] = useState("");
  const [visionLeft, setVisionLeft] = useState("");
  const [visionRight, setVisionRight] = useState("");
  const [dental, setDental] = useState("");
  const [ent, setEnt] = useState("");
  const [neurology, setNeurology] = useState("");
  const [pulse, setPulse] = useState("");
  const [internalMedicine, setInternalMedicine] = useState("");
  const [dermatology, setDermatology] = useState("");
  const [surgery, setSurgery] = useState("");
  const [bloodTest, setBloodTest] = useState("");
  const [urineTest, setUrineTest] = useState("");
  const [ultrasound, setUltrasound] = useState("");
  const [ecg, setEcg] = useState("");
  const [chestXray, setChestXray] = useState("");
  const [drugHivScreen, setDrugHivScreen] = useState("");

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");

    const h = parseFloat(height);
    const w = parseFloat(weight);
    if (!h || !w || !doctor.trim()) {
      setError("Vui lòng nhập chiều cao, cân nặng và bác sĩ khám.");
      return;
    }

    setLoading(true);
    try {
      const body = {
        citizenId,
        year,
        phase,
        height: h,
        weight: w,
        bloodPressure: bloodPressure || "—",
        vision: vision || "—",
        conclusion,
        doctor: doctor.trim(),
        note: note.trim() || undefined,
        detail: {
          facility: facility.trim(),
          ...(isScreening
            ? { physicalDefects: physicalDefects.trim() || undefined }
            : {
                chestCircumference: chestCircumference
                  ? parseFloat(chestCircumference)
                  : undefined,
                visionLeft: visionLeft || undefined,
                visionRight: visionRight || undefined,
                dental: dental || undefined,
                ent: ent || undefined,
                neurology: neurology || undefined,
                pulse: pulse || undefined,
                internalMedicine: internalMedicine || undefined,
                dermatology: dermatology || undefined,
                surgery: surgery || undefined,
                bloodTest: bloodTest || undefined,
                urineTest: urineTest || undefined,
                ultrasound: ultrasound || undefined,
                ecg: ecg || undefined,
                chestXray: chestXray || undefined,
                drugHivScreen: drugHivScreen || undefined,
                labTests: [
                  bloodTest && `Máu: ${bloodTest}`,
                  urineTest && `Nước tiểu: ${urineTest}`,
                  ultrasound && `Siêu âm: ${ultrasound}`,
                  ecg && `Điện tim: ${ecg}`,
                  chestXray && `X-quang: ${chestXray}`,
                  drugHivScreen && `Sàng lọc: ${drugHivScreen}`,
                ]
                  .filter(Boolean)
                  .join(". ") || undefined,
              }),
        },
      };

      const res = await fetch("/api/admin/health", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Không lưu được kết quả khám");

      onSaved(data);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lỗi hệ thống");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center sm:p-4">
      <button
        type="button"
        aria-label="Đóng"
        className="absolute inset-0 bg-black/45"
        onClick={onClose}
      />
      <div className="relative flex max-h-[92vh] w-full max-w-[640px] flex-col overflow-hidden rounded-t-[20px] bg-m3-surface-lowest shadow-2xl sm:rounded-[20px]">
        <header className="flex shrink-0 items-center justify-between border-b border-black/[0.06] px-5 py-4">
          <div className="min-w-0 pr-3">
            <p className="text-[17px] font-bold text-m3-on-surface">
              {isScreening ? "Vòng 1 — Sơ tuyển cấp xã" : "Vòng 2 — Khám chi tiết"}
            </p>
            <p className="mt-0.5 truncate text-[13px] text-m3-on-surface-variant">
              {citizenName} · Đợt {year}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 hover:bg-black/[0.05]"
          >
            <X size={20} />
          </button>
        </header>

        <form
          onSubmit={handleSubmit}
          className="custom-scrollbar flex min-h-0 flex-1 flex-col overflow-hidden"
        >
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {error && (
            <p className="mb-4 rounded-[12px] bg-m3-error/8 px-3 py-2 text-[13px] text-m3-error">
              {error}
            </p>
          )}

          <p className="mb-4 rounded-[12px] bg-m3-primary/6 px-3 py-2 text-[12px] leading-relaxed text-m3-primary">
            {isScreening
              ? "Khám thể lực, phát hiện dị tật hoặc bệnh lý rõ ràng tại Trạm Y tế xã. Kết quả Loại 1–3 được chuyển khám chi tiết cấp huyện/tỉnh."
              : "Khám thể lực, các chuyên khoa lâm sàng và cận lâm sàng theo quy định BQP. Phân loại sức khỏe Loại 1–6."}
          </p>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className={labelCls}>Cơ sở khám</label>
              <input className={inputCls} value={facility} onChange={(e) => setFacility(e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>Chiều cao (cm) *</label>
              <input className={inputCls} type="number" value={height} onChange={(e) => setHeight(e.target.value)} required />
            </div>
            <div>
              <label className={labelCls}>Cân nặng (kg) *</label>
              <input className={inputCls} type="number" value={weight} onChange={(e) => setWeight(e.target.value)} required />
            </div>
            <div>
              <label className={labelCls}>Huyết áp</label>
              <input className={inputCls} placeholder="120/80" value={bloodPressure} onChange={(e) => setBloodPressure(e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>Thị lực (sơ bộ)</label>
              <input className={inputCls} placeholder="10/10" value={vision} onChange={(e) => setVision(e.target.value)} />
            </div>

            {isScreening ? (
              <div className="sm:col-span-2">
                <label className={labelCls}>Dị tật / bệnh lý phát hiện</label>
                <textarea
                  className={`${inputCls} min-h-[72px] resize-y`}
                  placeholder="Không phát hiện dị tật, dị dạng thuộc diện miễn NVQS"
                  value={physicalDefects}
                  onChange={(e) => setPhysicalDefects(e.target.value)}
                />
              </div>
            ) : (
              <>
                <div>
                  <label className={labelCls}>Vòng ngực (cm)</label>
                  <input className={inputCls} type="number" value={chestCircumference} onChange={(e) => setChestCircumference(e.target.value)} />
                </div>
                <div>
                  <label className={labelCls}>Mạch</label>
                  <input className={inputCls} placeholder="72 l/phút" value={pulse} onChange={(e) => setPulse(e.target.value)} />
                </div>
                <div>
                  <label className={labelCls}>Mắt trái</label>
                  <input className={inputCls} value={visionLeft} onChange={(e) => setVisionLeft(e.target.value)} />
                </div>
                <div>
                  <label className={labelCls}>Mắt phải</label>
                  <input className={inputCls} value={visionRight} onChange={(e) => setVisionRight(e.target.value)} />
                </div>
                <div className="sm:col-span-2">
                  <label className={labelCls}>Răng – Hàm – Mặt</label>
                  <textarea className={`${inputCls} min-h-[60px]`} value={dental} onChange={(e) => setDental(e.target.value)} />
                </div>
                <div className="sm:col-span-2">
                  <label className={labelCls}>Tai – Mũi – Họng</label>
                  <textarea className={`${inputCls} min-h-[60px]`} value={ent} onChange={(e) => setEnt(e.target.value)} />
                </div>
                <div className="sm:col-span-2">
                  <label className={labelCls}>Tâm thần – Thần kinh</label>
                  <textarea className={`${inputCls} min-h-[60px]`} value={neurology} onChange={(e) => setNeurology(e.target.value)} />
                </div>
                <div className="sm:col-span-2">
                  <label className={labelCls}>Nội khoa (phổi, tim)</label>
                  <textarea className={`${inputCls} min-h-[60px]`} value={internalMedicine} onChange={(e) => setInternalMedicine(e.target.value)} />
                </div>
                <div className="sm:col-span-2">
                  <label className={labelCls}>Da liễu</label>
                  <textarea className={`${inputCls} min-h-[60px]`} value={dermatology} onChange={(e) => setDermatology(e.target.value)} />
                </div>
                <div className="sm:col-span-2">
                  <label className={labelCls}>Ngoại khoa</label>
                  <textarea className={`${inputCls} min-h-[60px]`} value={surgery} onChange={(e) => setSurgery(e.target.value)} />
                </div>
                <div className="sm:col-span-2 mt-1 border-t border-black/[0.06] pt-3">
                  <p className="mb-2 text-[13px] font-bold text-m3-primary">Cận lâm sàng</p>
                </div>
                <div className="sm:col-span-2">
                  <label className={labelCls}>Xét nghiệm máu</label>
                  <textarea className={`${inputCls} min-h-[52px]`} value={bloodTest} onChange={(e) => setBloodTest(e.target.value)} />
                </div>
                <div className="sm:col-span-2">
                  <label className={labelCls}>Xét nghiệm nước tiểu</label>
                  <textarea className={`${inputCls} min-h-[52px]`} value={urineTest} onChange={(e) => setUrineTest(e.target.value)} />
                </div>
                <div className="sm:col-span-2">
                  <label className={labelCls}>Siêu âm</label>
                  <textarea className={`${inputCls} min-h-[52px]`} value={ultrasound} onChange={(e) => setUltrasound(e.target.value)} />
                </div>
                <div className="sm:col-span-2">
                  <label className={labelCls}>Điện tim</label>
                  <textarea className={`${inputCls} min-h-[52px]`} value={ecg} onChange={(e) => setEcg(e.target.value)} />
                </div>
                <div className="sm:col-span-2">
                  <label className={labelCls}>X-quang phổi</label>
                  <textarea className={`${inputCls} min-h-[52px]`} value={chestXray} onChange={(e) => setChestXray(e.target.value)} />
                </div>
                <div className="sm:col-span-2">
                  <label className={labelCls}>Sàng lọc ma túy / HIV</label>
                  <textarea className={`${inputCls} min-h-[52px]`} value={drugHivScreen} onChange={(e) => setDrugHivScreen(e.target.value)} />
                </div>
              </>
            )}

            <div>
              <label className={labelCls}>Phân loại sức khỏe *</label>
              <select
                className={inputCls}
                value={conclusion}
                onChange={(e) => setConclusion(e.target.value)}
              >
                {HEALTH_CONCLUSIONS.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Bác sĩ khám *</label>
              <input className={inputCls} value={doctor} onChange={(e) => setDoctor(e.target.value)} required />
            </div>
            <div className="sm:col-span-2">
              <label className={labelCls}>Ghi chú / kết luận</label>
              <textarea className={`${inputCls} min-h-[64px]`} value={note} onChange={(e) => setNote(e.target.value)} />
            </div>
          </div>
          </div>

          <footer className="flex shrink-0 gap-2 border-t border-black/[0.06] px-5 py-4">
            <button
              type="button"
              onClick={onClose}
              className="min-h-[44px] flex-1 rounded-[12px] border border-black/[0.1] text-[15px] font-semibold text-m3-on-surface"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={loading}
              className="inline-flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-[12px] bg-m3-primary text-[15px] font-semibold text-white disabled:opacity-60"
            >
              {loading && <Loader2 size={16} className="animate-spin" />}
              Lưu kết quả khám
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
}
