"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Download, ExternalLink, FileText, Loader2 } from "lucide-react";

type ArchiveDoc = {
  code: string;
  title: string;
  issuer: string;
  issued_date: string;
  public_url: string;
  source_url: string;
};

export default function DocumentViewerPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [doc, setDoc] = useState<ArchiveDoc | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const loadDocument = async () => {
      try {
        const response = await fetch(
          `/api/admin/document-archive/${encodeURIComponent(params.id)}`,
        );
        const json = await response.json();
        if (!response.ok) throw new Error(json.error || "Không mở được văn bản");
        setDoc(json.data);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Lỗi tải văn bản");
      } finally {
        setLoading(false);
      }
    };

    void loadDocument();
  }, [params.id]);

  return (
    <div
      className="flex min-h-[600px] flex-col gap-4"
      style={{ height: "calc(100vh - 7rem)" }}
    >
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => router.back()}
          className="inline-flex items-center gap-2 rounded-xl border border-m3-outline-variant bg-m3-surface-lowest px-4 py-2.5 text-sm font-semibold text-m3-on-surface-variant transition-colors hover:bg-m3-surface-container"
        >
          <ArrowLeft size={18} />
          Quay lại kho văn bản
        </button>
        {doc && (
          <div className="flex items-center gap-2">
            <a
              href={doc.public_url}
              download
              className="inline-flex items-center gap-2 rounded-xl bg-m3-primary px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:opacity-90"
            >
              <Download size={17} />
              Tải PDF
            </a>
            {doc.source_url && (
              <a
                href={doc.source_url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-xl border border-m3-outline-variant bg-m3-surface-lowest px-4 py-2.5 text-sm font-semibold text-m3-on-surface-variant transition-colors hover:bg-m3-surface-container"
              >
                <ExternalLink size={17} />
                Nguồn gốc
              </a>
            )}
          </div>
        )}
      </div>

      <section
        className="flex min-h-[520px] flex-1 flex-col overflow-hidden rounded-2xl border border-m3-outline-variant bg-m3-surface-lowest shadow-sm"
        style={{ height: "calc(100vh - 12rem)" }}
      >
        {loading ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 text-m3-on-surface-variant">
            <Loader2 size={30} className="animate-spin" />
            <p>Đang mở văn bản...</p>
          </div>
        ) : error ? (
          <div className="flex flex-1 items-center justify-center p-6 text-sm text-m3-error">
            {error}
          </div>
        ) : doc ? (
          <>
            <div className="flex shrink-0 items-center gap-3 border-b border-m3-outline-variant px-5 py-3">
              <FileText size={21} className="text-m3-primary" />
              <div className="min-w-0">
                <h1 className="truncate text-base font-bold text-m3-on-surface">
                  {doc.code}
                </h1>
                <p className="truncate text-sm text-m3-on-surface-variant">
                  {doc.title} · {doc.issuer} · {doc.issued_date}
                </p>
              </div>
            </div>
            <iframe
              src={doc.public_url}
              title={`Xem ${doc.code}`}
              className="min-h-0 flex-1 border-0"
            />
          </>
        ) : null}
      </section>
    </div>
  );
}
