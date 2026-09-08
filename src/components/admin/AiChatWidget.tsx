"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { MessageCircle, Send, Sparkles, X, Loader2 } from "lucide-react";

type ChatMsg = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

const SUGGESTIONS = [
  "Tóm tắt tình hình NVQS hiện tại",
  "Có bao nhiêu người tạm hoãn?",
  "Có bao nhiêu công dân đã đậu?",
];

export default function AiChatWidget() {
  const [open, setOpen] = useState(false);
  const [configured, setConfigured] = useState(false);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const sync = () =>
      setDrawerOpen(
        document.body.hasAttribute("data-admin-drawer-open"),
      );
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ["data-admin-drawer-open"],
    });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    fetch("/api/admin/ai/chat")
      .then((r) => r.json())
      .then((j) => setConfigured(Boolean(j.configured)))
      .catch(() => setConfigured(false));
  }, []);

  useEffect(() => {
    if (!open) return;
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, open, loading]);

  useEffect(() => {
    if (open) {
      window.setTimeout(() => inputRef.current?.focus(), 80);
    }
  }, [open]);

  const send = useCallback(
    async (text: string) => {
      const q = text.trim();
      if (!q || loading) return;

      setError(null);
      setInput("");
      const userMsg: ChatMsg = {
        id: `u-${Date.now()}`,
        role: "user",
        content: q,
      };
      setMessages((prev) => [...prev, userMsg]);
      setLoading(true);

      try {
        const history = messages.map((m) => ({
          role: m.role,
          content: m.content,
        }));

        const res = await fetch("/api/admin/ai/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: q, history }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Không trả lời được");

        setMessages((prev) => [
          ...prev,
          {
            id: `a-${Date.now()}`,
            role: "assistant",
            content: data.reply,
          },
        ]);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Lỗi kết nối AI");
      } finally {
        setLoading(false);
      }
    },
    [loading, messages],
  );

  if (!configured) return null;

  return (
    <>
      {!open && !drawerOpen && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          title="Trợ lý AI"
          className="fixed bottom-5 right-5 z-30 inline-flex h-11 w-11 items-center justify-center rounded-full bg-m3-primary text-white shadow-[0_8px_24px_color-mix(in srgb, var(--m3-primary, #1a73e8) 35%, transparent)] transition hover:bg-m3-primary hover:shadow-[0_10px_28px_color-mix(in srgb, var(--m3-primary, #1a73e8) 40%, transparent)]"
          aria-label="Mở chat AI"
        >
          <MessageCircle size={20} />
        </button>
      )}

      {open && (
        <div
          className="fixed bottom-5 right-5 z-40 flex w-[min(100vw-2rem,400px)] flex-col overflow-hidden rounded-[22px] border border-black/[0.08] bg-m3-surface-lowest shadow-[0_24px_64px_rgba(0,0,0,0.18)]"
          style={{ height: "min(560px, calc(100vh - 6rem))" }}
        >
          <header className="flex shrink-0 items-center justify-between gap-3 bg-gradient-to-r from-m3-primary to-m3-primary px-4 py-3.5 text-white">
            <div className="flex min-w-0 items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-m3-surface-lowest/20">
                <Sparkles size={18} />
              </div>
              <div className="min-w-0">
                <p className="truncate text-[15px] font-bold">Trợ lý NVQS</p>
                <p className="truncate text-[12px] text-white/85">
                  Hỏi về hồ sơ & thống kê trong phạm vi của bạn
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full hover:bg-m3-surface-lowest/20"
              aria-label="Đóng chat"
            >
              <X size={18} />
            </button>
          </header>

          <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto bg-m3-surface-high px-3.5 py-4">
            {messages.length === 0 && (
              <div className="space-y-3">
                <p className="text-[14px] leading-relaxed text-m3-on-surface-variant">
                  Xin chào! Tôi đọc dữ liệu hồ sơ / NVQS trong phạm vi đơn vị của bạn
                  rồi trả lời. Thử hỏi:
                </p>
                <div className="flex flex-col gap-2">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => send(s)}
                      className="rounded-[14px] border border-black/[0.06] bg-m3-surface-lowest px-3.5 py-2.5 text-left text-[13px] font-medium text-m3-on-surface transition hover:border-m3-primary/30 hover:bg-m3-primary/4"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((m) => (
              <div
                key={m.id}
                className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[88%] whitespace-pre-wrap rounded-[16px] px-3.5 py-2.5 text-[14px] leading-relaxed ${
                    m.role === "user"
                      ? "bg-m3-primary text-white"
                      : "border border-black/[0.06] bg-m3-surface-lowest text-m3-on-surface"
                  }`}
                >
                  {m.content}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex items-center gap-2 text-[13px] text-m3-on-surface-variant">
                <Loader2 size={16} className="animate-spin text-m3-primary" />
                Đang đọc dữ liệu và trả lời...
              </div>
            )}

            {error && (
              <p className="rounded-[12px] bg-m3-error/8 px-3 py-2 text-[13px] text-m3-error">
                {error}
              </p>
            )}
          </div>

          <form
            className="flex shrink-0 items-end gap-2 border-t border-black/[0.06] bg-m3-surface-lowest p-3"
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
          >
            <textarea
              ref={inputRef}
              rows={1}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send(input);
                }
              }}
              placeholder="Hỏi về hồ sơ, trạng thái NVQS..."
              className="max-h-28 min-h-[44px] flex-1 resize-none rounded-[14px] border-0 bg-m3-surface-high px-3.5 py-3 text-[14px] text-m3-on-surface outline-none focus:ring-2 focus:ring-m3-primary/20"
              disabled={loading}
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] bg-m3-primary text-white transition hover:bg-m3-primary disabled:opacity-40"
              aria-label="Gửi"
            >
              <Send size={18} />
            </button>
          </form>
        </div>
      )}
    </>
  );
}
