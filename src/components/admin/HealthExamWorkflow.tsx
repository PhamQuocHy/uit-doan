"use client";

import type { HealthRecord } from "@/lib/data";
import {
  screeningRecordForYear,
  detailedRecordForYear,
  isScreeningPass,
  getAvailableExamRounds,
  getYearExamStatusLabel,
  yearHasOpenExamSlot,
  type HealthExamRound,
} from "@/lib/health-exam";
import { Check, ChevronDown } from "lucide-react";

type Props = {
  year: number;
  records: HealthRecord[];
  canEnter: boolean;
  yearOptions: number[];
  onYearChange: (year: number) => void;
  onEnterRound: (round: HealthExamRound) => void;
};

export default function HealthExamWorkflow({
  year,
  records,
  canEnter,
  yearOptions,
  onYearChange,
  onEnterRound,
}: Props) {
  const screening = screeningRecordForYear(records, year);
  const detailed = detailedRecordForYear(records, year);
  const available = getAvailableExamRounds(records, year);
  const statusLabel = getYearExamStatusLabel(records, year);
  const currentYear = new Date().getFullYear();
  const hasOpenSlot = yearHasOpenExamSlot(records, year);
  const nextOpenYear = yearOptions.find((y) => yearHasOpenExamSlot(records, y));

  const round1Done = Boolean(screening);
  const round2Done = Boolean(detailed);
  const round1Active = !round1Done;
  const round2Active =
    round1Done &&
    Boolean(screening && isScreeningPass(screening.conclusion)) &&
    !round2Done;

  const steps = [
    {
      n: 1,
      label: "Vòng 1 — Sơ tuyển xã",
      done: round1Done,
      active: round1Active,
      result: screening?.conclusion,
    },
    {
      n: 2,
      label: "Vòng 2 — Khám chi tiết",
      done: round2Done,
      active: round2Active,
      result: detailed?.conclusion,
    },
  ];

  return (
    <div className="overflow-hidden rounded-[16px] bg-m3-primary">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/15 px-4 py-3 sm:px-5">
        <div className="min-w-0">
          <p className="text-[12px] font-medium text-white/75">
            Chu kỳ khám theo năm (18–27 tuổi · mỗi năm nhập riêng)
          </p>
          <p className="mt-0.5 text-[14px] font-semibold text-white">
            {statusLabel}
            {year === currentYear ? " · năm hiện tại" : ""}
          </p>
        </div>
        <label className="relative inline-flex min-h-[40px] items-center gap-2 rounded-full bg-white/15 px-3.5 text-[14px] font-bold text-white">
          Năm
          <select
            value={year}
            onChange={(e) => onYearChange(Number(e.target.value))}
            className="cursor-pointer appearance-none bg-transparent pr-6 text-[14px] font-bold text-white outline-none"
            aria-label="Chọn năm khám"
          >
            {yearOptions.map((y) => (
              <option key={y} value={y} className="text-m3-on-surface">
                {y}
                {yearHasOpenExamSlot(records, y) ? " · còn nhập" : " · đã có"}
              </option>
            ))}
          </select>
          <ChevronDown size={16} className="pointer-events-none absolute right-3 text-white/90" />
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-3 px-4 py-4 sm:px-5">
        {steps.map((step, i) => (
          <div key={step.n} className="flex min-w-0 flex-1 items-center gap-3">
            <div
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[14px] font-bold ${
                step.done
                  ? "bg-m3-surface-lowest text-m3-success"
                  : step.active
                    ? "bg-m3-surface-lowest text-m3-primary"
                    : "border-2 border-white/50 bg-transparent text-white/70"
              }`}
            >
              {step.done ? <Check size={16} strokeWidth={2.5} /> : step.n}
            </div>
            <div className="min-w-0">
              <p
                className={`truncate text-[14px] font-semibold ${
                  step.done || step.active ? "text-white" : "text-white/55"
                }`}
              >
                {step.label}
              </p>
              {step.result && (
                <p className="text-[12px] font-medium text-white/85">
                  {step.result}
                </p>
              )}
            </div>
            {i < steps.length - 1 && (
              <div className="mx-1 hidden h-px flex-1 bg-m3-surface-lowest/35 sm:block" />
            )}
          </div>
        ))}
      </div>

      {canEnter && (
        <div className="flex flex-wrap gap-2 border-t border-white/15 bg-m3-primary/40 px-4 py-3 sm:px-5">
          <button
            type="button"
            disabled={!available.includes("screening")}
            onClick={() => onEnterRound("screening")}
            className="min-h-[40px] rounded-[12px] bg-m3-surface-lowest px-4 text-[14px] font-semibold text-m3-primary transition disabled:cursor-not-allowed disabled:opacity-40"
          >
            Nhập vòng 1 · {year}
          </button>
          <button
            type="button"
            disabled={!available.includes("detailed")}
            onClick={() => onEnterRound("detailed")}
            className="min-h-[40px] rounded-[12px] border border-white/60 bg-transparent px-4 text-[14px] font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-40"
          >
            Nhập vòng 2 · {year}
          </button>

          {!hasOpenSlot &&
            round1Done &&
            screening &&
            !isScreeningPass(screening.conclusion) &&
            !round2Done && (
              <p className="w-full text-[12px] leading-snug text-white/85">
                Năm {year}: không đạt sơ tuyển — không nhập vòng 2. Sang năm sau
                chọn năm mới để khám lại (hồ sơ giữ lịch sử để đối chiếu).
                {nextOpenYear && nextOpenYear !== year ? (
                  <>
                    {" "}
                    <button
                      type="button"
                      className="font-bold underline underline-offset-2"
                      onClick={() => onYearChange(nextOpenYear)}
                    >
                      Chuyển sang năm {nextOpenYear}
                    </button>
                  </>
                ) : null}
              </p>
            )}

          {!hasOpenSlot && round2Done && (
            <p className="w-full text-[12px] leading-snug text-white/85">
              Năm {year} đã đủ vòng khám. Chọn năm khác trong độ tuổi NVQS để nhập
              chu kỳ mới.
              {nextOpenYear ? (
                <>
                  {" "}
                  <button
                    type="button"
                    className="font-bold underline underline-offset-2"
                    onClick={() => onYearChange(nextOpenYear)}
                  >
                    Chuyển sang năm {nextOpenYear}
                  </button>
                </>
              ) : null}
            </p>
          )}

          {hasOpenSlot && !round1Done && (
            <p className="w-full text-[12px] text-white/80">
              Năm {year} chưa có sơ tuyển — bấm Nhập vòng 1 để ghi nhận lần khám.
            </p>
          )}
        </div>
      )}

      {!canEnter && (
        <div className="border-t border-white/15 px-4 py-2.5 sm:px-5">
          <p className="text-[12px] text-white/75">
            Bấm <strong>Sửa hồ sơ</strong> rồi chọn năm để nhập vòng khám.
          </p>
        </div>
      )}
    </div>
  );
}
