import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { findCitizenByCccdFromDb } from "@/lib/citizens-db";
import {
  extractCccdFromNaturalLanguage,
  transcribeAudioAndExtractCccd,
} from "@/lib/ai-voice-cccd";
import { isGeminiConfigured } from "@/lib/gemini";
import type { Citizen } from "@/lib/data";

function toPublicCitizen(c: Citizen) {
  return {
    id: c.id,
    fullName: c.fullName,
    cccd: c.cccd,
    dateOfBirth: c.dateOfBirth,
    address: c.address || "",
    militaryStatus: c.militaryStatus,
    gender: c.gender,
    phone: c.phone || "",
    avatar: c.avatar || undefined,
  };
}

async function respondWithCccd(args: {
  transcript: string;
  cccd: string | null;
  method: string;
}) {
  if (!args.cccd) {
    return NextResponse.json({
      ok: false,
      found: false,
      transcript: args.transcript,
      cccd: null,
      method: args.method,
      citizen: null,
      error:
        "Không trích được số CCCD từ lời nói. Hãy đọc rõ 12 chữ số (ví dụ: không bảy chín… hoặc 0790…).",
      geminiReady: isGeminiConfigured(),
    });
  }

  const citizen = await findCitizenByCccdFromDb(args.cccd);
  return NextResponse.json({
    ok: true,
    found: Boolean(citizen),
    transcript: args.transcript,
    cccd: args.cccd,
    method: args.method,
    citizen: citizen ? toPublicCitizen(citizen) : null,
    message: citizen
      ? `Đã tìm thấy hồ sơ: ${citizen.fullName}`
      : `Đã trích CCCD ${args.cccd} nhưng chưa có hồ sơ trong hệ thống.`,
  });
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const transcriptIn =
      typeof body.transcript === "string" ? body.transcript.trim() : "";
    const audioBase64 =
      typeof body.audioBase64 === "string" ? body.audioBase64.trim() : "";
    const mimeType =
      typeof body.mimeType === "string" ? body.mimeType.trim() : "audio/webm";

    // Ưu tiên file ghi âm (micro đã chọn) — ổn định hơn Web Speech API
    if (audioBase64 && audioBase64.length > 80) {
      if (!isGeminiConfigured()) {
        return NextResponse.json(
          {
            error:
              "Chưa cấu hình GEMINI_API_KEY. Thêm vào .env rồi khởi động lại server để nhận dạng giọng nói.",
          },
          { status: 503 },
        );
      }

      const audioResult = await transcribeAudioAndExtractCccd({
        audioBase64,
        mimeType,
      });
      return respondWithCccd({
        transcript: audioResult.transcript,
        cccd: audioResult.cccd,
        method: audioResult.method,
      });
    }

    if (!transcriptIn || transcriptIn.length < 3) {
      return NextResponse.json(
        {
          error:
            "Thiếu file ghi âm hoặc văn bản. Bấm mic đọc CCCD rồi dừng, hoặc dán lời nói vào ô văn bản.",
        },
        { status: 400 },
      );
    }

    const extracted = await extractCccdFromNaturalLanguage(transcriptIn);
    return respondWithCccd({
      transcript: transcriptIn,
      cccd: extracted.cccd,
      method: extracted.method,
    });
  } catch (error) {
    console.error("ai-voice lookup error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Không xử lý được lời nói.",
      },
      { status: 500 },
    );
  }
}

export async function GET() {
  return NextResponse.json({
    endpoint: "/api/admin/ai-voice/lookup",
    methods: ["POST"],
    body: {
      audioBase64: "data:audio/webm;base64,... (ưu tiên)",
      mimeType: "audio/webm",
      transcript: "string — tùy chọn nếu không gửi audio",
    },
    geminiReady: isGeminiConfigured(),
  });
}
