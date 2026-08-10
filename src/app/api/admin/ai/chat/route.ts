import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { buildChatKnowledgeContext } from "@/lib/analytics/chat-context";
import {
  generateGeminiChat,
  getGeminiModel,
  isGeminiConfigured,
  type GeminiChatMessage,
} from "@/lib/gemini";

const SYSTEM = `Bạn là trợ lý AI của hệ thống YMSA — Quản lý nghĩa vụ quân sự Việt Nam.
Trả lời bằng tiếng Việt CÓ DẤU đầy đủ (ví dụ: Thống kê, Cần Thơ, Chưa khám, Tạm hoãn).
Tuyệt đối KHÔNG viết tiếng Việt không dấu.

Định dạng:
- Dùng danh sách gạch đầu dòng (- hoặc •).
- KHÔNG dùng bảng markdown.
- KHÔNG dùng in đậm markdown (không viết **chữ**), không dùng * nghiêng, không dùng # tiêu đề markdown.
- Viết tiêu đề bình thường rồi xuống dòng, ví dụ: Thống kê hồ sơ tại Thành phố Cần Thơ:
- Khi hỏi tổng hồ sơ 1 tỉnh/TP: trả lời rõ số từ mục thống kê trong ngữ cảnh.
- Cấp Bộ xem được toàn quốc và từng tỉnh — không nói thiếu quyền nếu ngữ cảnh đã có số liệu.
- Khi hỏi luật / thông tư / độ tuổi / tạm hoãn / miễn gọi / tuyển chọn / sức khỏe: ưu tiên Kho văn bản pháp lý trong ngữ cảnh (đặc biệt 80/VBHN-VPQH, 98/2025/QH15, 68/2025/TT-BQP, 106/2025/TT-BQP) và nêu số hiệu văn bản.

Chỉ dùng dữ liệu ngữ cảnh. Không bịa số. Nếu ngữ cảnh đã liệt kê tỉnh đó, PHẢI trả lời đúng con số đó.`;

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isGeminiConfigured()) {
    return NextResponse.json(
      {
        error:
          "Chưa cấu hình GEMINI_API_KEY. Thêm vào .env và khởi động lại server.",
      },
      { status: 503 },
    );
  }

  try {
    const body = await request.json();
    const message = String(body.message || "").trim();
    const history = Array.isArray(body.history) ? body.history : [];

    if (!message) {
      return NextResponse.json({ error: "Vui lòng nhập câu hỏi" }, { status: 400 });
    }

    if (message.length > 2000) {
      return NextResponse.json(
        { error: "Câu hỏi quá dài (tối đa 2000 ký tự)" },
        { status: 400 },
      );
    }

    const { text: knowledge, source, focus } = await buildChatKnowledgeContext(
      {
        hierarchyLevel: session.hierarchyLevel,
        unitCode: session.unitCode,
        name: session.name,
      },
      message,
    );

    const prior: GeminiChatMessage[] = history
      .slice(-6)
      .map((h: { role?: string; content?: string }) => ({
        role: h.role === "assistant" ? ("model" as const) : ("user" as const),
        text: String(h.content || "").slice(0, 1200),
      }))
      .filter((h: GeminiChatMessage) => h.text);

    const focusNote =
      focus.length > 0
        ? `\n(Đã nhận diện địa bàn trong câu hỏi: ${focus.join(", ")})`
        : "";

    const messages: GeminiChatMessage[] = [
      ...prior,
      {
        role: "user",
        text: `Ngữ cảnh dữ liệu hệ thống:${focusNote}\n---\n${knowledge}\n---\n\nCâu hỏi: ${message}\n\nHãy trả lời đúng số liệu trong ngữ cảnh, bằng tiếng Việt có dấu đầy đủ, không dùng ** markdown.`,
      },
    ];

    const reply = await generateGeminiChat(messages, {
      systemInstruction: SYSTEM,
      temperature: 0.2,
    });

    // Bỏ markdown ** * còn sót lại để chat sạch
    const cleanReply = reply
      .replace(/\*\*([^*]+)\*\*/g, "$1")
      .replace(/__([^_]+)__/g, "$1")
      .replace(/(^|\s)\*([^*\n]+)\*(?=\s|$)/g, "$1$2")
      .replace(/^#{1,6}\s+/gm, "");

    return NextResponse.json({
      reply: cleanReply,
      model: getGeminiModel(),
      dataSource: source,
      focus,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("AI chat error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Không trả lời được câu hỏi",
      },
      { status: 500 },
    );
  }
}

export async function GET() {
  return NextResponse.json({
    endpoint: "/api/admin/ai/chat",
    configured: isGeminiConfigured(),
    model: process.env.GEMINI_MODEL || "gemini-3-flash-preview",
  });
}
