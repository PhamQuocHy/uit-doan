import { NextResponse } from "next/server";
import { generateGeminiJsonFromImage, isGeminiConfigured } from "@/lib/gemini";
import {
  assertSessionToken,
  bearerToken,
  getSessionById,
} from "@/lib/mobile/sessions";
import type { OcrFieldResult } from "@/lib/native/types";

function parseJsonObject(text: string): Record<string, string> {
  const trimmed = text.trim().replace(/^```json\s*/i, "").replace(/```$/i, "").trim();
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start < 0 || end <= start) return {};
  try {
    return JSON.parse(trimmed.slice(start, end + 1)) as Record<string, string>;
  } catch {
    return {};
  }
}

export async function POST(req: Request) {
  const body = (await req.json()) as {
    sessionId?: string;
    side?: "front" | "back";
    imageBase64?: string;
  };

  if (!body.sessionId || !body.imageBase64) {
    return NextResponse.json({ error: "sessionId and image required" }, { status: 400 });
  }
  if (body.imageBase64.length > 2_000_000) {
    return NextResponse.json({ error: "Ảnh quá lớn, hãy chụp lại" }, { status: 413 });
  }

  const row = await getSessionById(body.sessionId);
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const token = bearerToken(req.headers.get("authorization"));
  if (!assertSessionToken(row, token)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isGeminiConfigured()) {
    return NextResponse.json(
      { error: "Chưa cấu hình GEMINI_API_KEY nên không OCR được trên Safari." },
      { status: 503 },
    );
  }

  const side = body.side === "back" ? "back" : "front";
  const raw = await generateGeminiJsonFromImage({
    imageBase64: body.imageBase64,
    prompt: `Đây là ảnh CCCD Việt Nam mặt ${side === "front" ? "trước" : "sau"}. Trả về JSON thuần, không markdown, các khóa:
fullName, personalId, dateOfBirth (YYYY-MM-DD), gender (male|female), nationality, placeOfOrigin, placeOfResidence, can (6 số nếu có), mrz.
Không bịa. Để chuỗi rỗng nếu không đọc được.`,
  });

  const parsed = parseJsonObject(raw);
  const data: OcrFieldResult = {
    fullName: parsed.fullName || "",
    personalId: String(parsed.personalId || "").replace(/\D/g, ""),
    dateOfBirth: parsed.dateOfBirth || "",
    gender: parsed.gender || "",
    nationality: parsed.nationality || "Việt Nam",
    placeOfOrigin: parsed.placeOfOrigin || "",
    placeOfResidence: parsed.placeOfResidence || "",
    can: String(parsed.can || "").replace(/\D/g, "").slice(0, 6),
    mrz: parsed.mrz || "",
  };

  return NextResponse.json({ success: true, data });
}
