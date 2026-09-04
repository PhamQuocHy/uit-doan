"use client";

import { useEffect } from "react";
import { X } from "lucide-react";
import { clsx } from "clsx";
import Button from "./Button";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
}

/**
 * M3 Expressive dialog — scrim, 28px corners, expressive scale-in.
 */
export default function Modal({
  isOpen,
  onClose,
  title,
  children,
  footer,
  size = "md",
}: ModalProps) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const sizes = {
    sm: "max-w-sm",
    md: "max-w-lg",
    lg: "max-w-2xl",
    xl: "max-w-4xl",
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Scrim */}
      <div
        className="m3-scrim-in absolute inset-0 bg-m3-on-surface/50 backdrop-blur-[2px]"
        onClick={onClose}
      />
      {/* Dialog */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={clsx(
          "m3-dialog-in relative flex max-h-[90vh] w-full flex-col overflow-hidden rounded-[28px]",
          "bg-m3-surface-lowest shadow-[0_24px_64px_rgba(0,0,0,0.24)]",
          sizes[size],
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4">
          <h2 className="text-lg font-semibold text-m3-on-surface">{title}</h2>
          <button
            onClick={onClose}
            aria-label="Đóng"
            className="rounded-full p-2 text-m3-on-surface-variant transition-colors duration-200 hover:bg-m3-on-surface/8"
          >
            <X size={18} />
          </button>
        </div>
        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 pb-4">{children}</div>
        {/* Footer */}
        {footer && (
          <div className="flex items-center justify-end gap-3 px-6 py-4">
            {footer}
          </div>
        )}
      </div>
      <style>{`
        @keyframes m3ScrimIn { from { opacity: 0 } to { opacity: 1 } }
        @keyframes m3DialogIn {
          from { opacity: 0; transform: scale(0.88) translateY(16px); }
          to   { opacity: 1; transform: scale(1) translateY(0); }
        }
        .m3-scrim-in { animation: m3ScrimIn 200ms cubic-bezier(0.34,0.8,0.34,1) both; }
        .m3-dialog-in { animation: m3DialogIn 350ms cubic-bezier(0.38,1.21,0.22,1) both; }
      `}</style>
    </div>
  );
}

// Confirm Dialog component (built on Modal)
interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  loading?: boolean;
}

export function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = "Xác nhận",
  loading = false,
}: ConfirmDialogProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Hủy
          </Button>
          <Button variant="danger" onClick={onConfirm} loading={loading}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <p className="text-sm text-m3-on-surface-variant">{message}</p>
    </Modal>
  );
}
