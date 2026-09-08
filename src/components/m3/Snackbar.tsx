"use client";

import { useEffect, useState, type ReactNode } from "react";
import { CheckCircle2, AlertCircle, Info, X } from "lucide-react";
import { m3Curves, m3Duration, m3Rounding, withAlpha } from "./tokens";

export type M3SnackbarTone = "success" | "error" | "info" | "warning";

export type M3SnackbarProps = {
  open: boolean;
  message: string;
  tone?: M3SnackbarTone;
  /** ms — mặc định 3200 */
  duration?: number;
  onClose: () => void;
  actionLabel?: string;
  onAction?: () => void;
};

const TONE: Record<
  M3SnackbarTone,
  { bg: string; fg: string; icon: ReactNode }
> = {
  success: {
    bg: "var(--color-m3-success-container, #b5ccba)",
    fg: "var(--color-m3-on-success-container, #213528)",
    icon: <CheckCircle2 size={20} strokeWidth={2.25} />,
  },
  error: {
    bg: "var(--m3-error-container, #ffdad6)",
    fg: "var(--m3-on-error-container, #410002)",
    icon: <AlertCircle size={20} strokeWidth={2.25} />,
  },
  warning: {
    bg: "var(--color-m3-warning-container, #ffe08a)",
    fg: "var(--color-m3-on-warning-container, #3d2f00)",
    icon: <AlertCircle size={20} strokeWidth={2.25} />,
  },
  info: {
    bg: "var(--m3-inverse-surface, #313030)",
    fg: "var(--m3-inverse-on-surface, #f4f0ef)",
    icon: <Info size={20} strokeWidth={2.25} />,
  },
};

/**
 * Material 3 Snackbar — thông báo nổi, không dùng alert trắng viền đen.
 * Spec: https://m3.material.io/components/snackbar
 */
export function M3Snackbar({
  open,
  message,
  tone = "info",
  duration = 3200,
  onClose,
  actionLabel,
  onAction,
}: M3SnackbarProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!open) {
      setVisible(false);
      return;
    }
    const show = requestAnimationFrame(() => setVisible(true));
    const t = window.setTimeout(onClose, duration);
    return () => {
      cancelAnimationFrame(show);
      window.clearTimeout(t);
    };
  }, [open, duration, onClose, message]);

  if (!open && !visible) return null;

  const t = TONE[tone];

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-6 z-[100] flex justify-center px-4"
    >
      <div
        className="pointer-events-auto flex max-w-[min(100%,440px)] items-start gap-3 px-4 py-3.5 shadow-lg"
        style={{
          background: t.bg,
          color: t.fg,
          borderRadius: m3Rounding.large,
          boxShadow: `0 8px 28px ${withAlpha("#000", 0.18)}`,
          transform: visible ? "translateY(0) scale(1)" : "translateY(12px) scale(0.96)",
          opacity: visible ? 1 : 0,
          transition: `transform ${m3Duration.expressiveDefaultSpatial}ms ${m3Curves.expressiveDefaultSpatial}, opacity ${m3Duration.expressiveEffects}ms ${m3Curves.expressiveEffects}`,
        }}
      >
        <span className="mt-0.5 shrink-0 opacity-90">{t.icon}</span>
        <p className="flex-1 text-[14px] font-medium leading-snug tracking-[0.01em]">
          {message}
        </p>
        {actionLabel && onAction && (
          <button
            type="button"
            className="shrink-0 rounded-full px-3 py-1 text-[13px] font-bold uppercase tracking-wide"
            style={{ color: t.fg }}
            onClick={() => {
              onAction();
              onClose();
            }}
          >
            {actionLabel}
          </button>
        )}
        <button
          type="button"
          aria-label="Đóng"
          className="shrink-0 rounded-full p-1 opacity-70 hover:opacity-100"
          onClick={onClose}
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
}

export type M3ConfirmDialogProps = {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "primary" | "danger" | "success";
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

/**
 * Material 3 basic dialog — thay window.confirm trắng viền đen.
 */
export function M3ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Xác nhận",
  cancelLabel = "Hủy",
  tone = "primary",
  busy = false,
  onConfirm,
  onCancel,
}: M3ConfirmDialogProps) {
  if (!open) return null;

  const confirmBg =
    tone === "danger"
      ? "var(--m3-error, #ba1a1a)"
      : tone === "success"
        ? "var(--color-m3-success, #386a4a)"
        : "var(--m3-primary, #1a73e8)";

  return (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center p-4"
      style={{ background: withAlpha("#000", 0.45) }}
      role="presentation"
      onClick={onCancel}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="m3-confirm-title"
        className="w-full max-w-[400px] p-6 shadow-2xl"
        style={{
          background: "var(--m3-surface-container-high, #eef1f4)",
          borderRadius: m3Rounding.verylarge,
          transform: "scale(1)",
          animation: "none",
          boxShadow: `0 12px 40px ${withAlpha("#000", 0.22)}`,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2
          id="m3-confirm-title"
          className="text-[22px] font-semibold tracking-tight text-m3-on-surface"
        >
          {title}
        </h2>
        {description && (
          <p className="mt-3 text-[14px] leading-relaxed text-m3-on-surface-variant">
            {description}
          </p>
        )}
        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            disabled={busy}
            className="h-10 rounded-full px-5 text-[14px] font-semibold text-m3-primary disabled:opacity-50"
            onClick={onCancel}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            disabled={busy}
            className="h-10 rounded-full px-5 text-[14px] font-semibold text-white disabled:opacity-50"
            style={{ background: confirmBg }}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
