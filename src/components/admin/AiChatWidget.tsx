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
  "Liệt kê công dân đã đậu",
];

export default function AiChatWidget() {
  const [open, setOpen] = useState(false);
  const [configured, setConfigured] = useState(false);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

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
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="fixed bottom-6 right-6 z-50 inline-flex h-14 items-center gap-2 rounded-full bg-[#007aff] px-5 text-[15px] font-bold text-white shadow-[0_12px_40px_rgba(0,122,255,0.45)] transition hover:bg-[#0066d6] hover:shadow-[0_16px_48px_rgba(0,122,255,0.5)]"
          aria-label="Mở chat AI"
        >
          <MessageCircle size={22} />
          Trợ lý AI
        </button>
      )}

      {open && (
        <div
          className="fixed bottom-6 right-6 z-50 flex w-[min(100vw-2rem,400px)] flex-col overflow-hidden rounded-[22px] border border-black/[0.08] bg-white shadow-[0_24px_64px_rgba(0,0,0,0.18)]"
          style={{ height: "min(560px, calc(100vh - 6rem))" }}
        >
          <header className="flex shrink-0 items-center justify-between gap-3 bg-gradient-to-r from-[#0a84ff] to-[#5ac8fa] px-4 py-3.5 text-white">
            <div className="flex min-w-0 items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/20">
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
              className="inline-flex h-9 w-9 items-center justify-center rounded-full hover:bg-white/20"
              aria-label="Đóng chat"
            >
              <X size={18} />
            </button>
          </header>

          <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto bg-[#f8fafb] px-3.5 py-4">
            {messages.length === 0 && (
              <div className="space-y-3">
                <p className="text-[14px] leading-relaxed text-[#6e6e73]">
                  Xin chào! Tôi đọc dữ liệu hồ sơ / NVQS trong phạm vi đơn vị của bạn
                  rồi trả lời. Thử hỏi:
                </p>
                <div className="flex flex-col gap-2">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => send(s)}
                      className="rounded-[14px] border border-black/[0.06] bg-white px-3.5 py-2.5 text-left text-[13px] font-medium text-[#1d1d1f] transition hover:border-[#007aff]/30 hover:bg-[rgba(0,122,255,0.04)]"
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
                      ? "bg-[#007aff] text-white"
                      : "border border-black/[0.06] bg-white text-[#1d1d1f]"
                  }`}
                >
                  {m.content}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex items-center gap-2 text-[13px] text-[#6e6e73]">
                <Loader2 size={16} className="animate-spin text-[#007aff]" />
                Đang đọc dữ liệu và trả lời...
              </div>
            )}

            {error && (
              <p className="rounded-[12px] bg-[rgba(255,59,48,0.08)] px-3 py-2 text-[13px] text-[#ff3b30]">
                {error}
              </p>
            )}
          </div>

          <form
            className="flex shrink-0 items-end gap-2 border-t border-black/[0.06] bg-white p-3"
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
              className="max-h-28 min-h-[44px] flex-1 resize-none rounded-[14px] border-0 bg-[#f5f5f7] px-3.5 py-3 text-[14px] text-[#1d1d1f] outline-none focus:ring-2 focus:ring-[#007aff]/20"
              disabled={loading}
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] bg-[#007aff] text-white transition hover:bg-[#0066d6] disabled:opacity-40"
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
