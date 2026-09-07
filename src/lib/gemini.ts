const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta";

export type GeminiChatMessage = {
  role: "user" | "model";
  text: string;
};

export function getGeminiModel(): string {
  return process.env.GEMINI_MODEL || "gemini-3-flash-preview";
}

export function isGeminiConfigured(): boolean {
  return Boolean(process.env.GEMINI_API_KEY?.trim());
}

type GeminiResponse = {
  error?: { message?: string };
  candidates?: { content?: { parts?: { text?: string }[] } }[];
};

async function callGemini(body: Record<string, unknown>): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error(
      "Chưa cấu hình GEMINI_API_KEY. Thêm vào file .env (lấy tại Google AI Studio).",
    );
  }

  const model = getGeminiModel();
  const url = `${GEMINI_BASE}/models/${model}:generateContent`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey,
    },
    body: JSON.stringify(body),
  });

  const data = (await res.json()) as GeminiResponse;

  if (!res.ok) {
    throw new Error(data.error?.message || `Gemini API lỗi (${res.status})`);
  }

  const text = data.candidates?.[0]?.content?.parts
    ?.map((p) => p.text || "")
    .join("")
    .trim();

  if (!text) {
    throw new Error("Gemini không trả về nội dung.");
  }

  return text;
}

/** Data URL có thể là data:audio/webm;codecs=opus;base64,... — chỉ lấy phần base64 thuần */
function stripBase64(data: string): string {
  const i = data.indexOf("base64,");
  if (i >= 0) return data.slice(i + "base64,".length);
  return data.replace(/\s/g, "");
}

function mimeFromDataUrl(data: string, fallback = "image/jpeg"): string {
  const m = /^data:([^;,]+)/.exec(data);
  return m?.[1]?.trim() || fallback;
}

export async function generateGeminiJsonFromImage(args: {
  imageBase64: string;
  mimeType?: string;
  prompt: string;
  systemInstruction?: string;
}): Promise<string> {
  return callGemini({
    systemInstruction: args.systemInstruction
      ? { parts: [{ text: args.systemInstruction }] }
      : undefined,
    contents: [
      {
        role: "user",
        parts: [
          { text: args.prompt },
          {
            inlineData: {
              mimeType:
                args.mimeType || mimeFromDataUrl(args.imageBase64),
              data: stripBase64(args.imageBase64),
            },
          },
        ],
      },
    ],
    generationConfig: {
      temperature: 0.1,
      maxOutputTokens: 1024,
    },
  });
}

/** So sánh nhiều ảnh (probe + các ảnh CCCD) — dùng nhận dạng khuôn mặt */
export async function generateGeminiJsonFromImages(args: {
  prompt: string;
  systemInstruction?: string;
  images: { base64: string; mimeType?: string; label?: string }[];
}): Promise<string> {
  const parts: { text?: string; inlineData?: { mimeType: string; data: string } }[] =
    [{ text: args.prompt }];

  for (const img of args.images) {
    if (img.label) parts.push({ text: img.label });
    parts.push({
      inlineData: {
        mimeType: img.mimeType || mimeFromDataUrl(img.base64),
        data: stripBase64(img.base64),
      },
    });
  }

  return callGemini({
    systemInstruction: args.systemInstruction
      ? { parts: [{ text: args.systemInstruction }] }
      : undefined,
    contents: [{ role: "user", parts }],
    generationConfig: {
      temperature: 0.05,
      maxOutputTokens: 512,
    },
  });
}

export async function generateGeminiText(
  prompt: string,
  options?: { systemInstruction?: string },
): Promise<string> {
  return callGemini({
    systemInstruction: options?.systemInstruction
      ? { parts: [{ text: options.systemInstruction }] }
      : undefined,
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.35,
      maxOutputTokens: 2048,
    },
  });
}

/** Nhận dạng / trích xuất từ file âm thanh (webm, mp3, wav, …) */
export async function generateGeminiJsonFromAudio(args: {
  audioBase64: string;
  mimeType?: string;
  prompt: string;
  systemInstruction?: string;
}): Promise<string> {
  // Gemini chỉ nhận mime thuần (audio/webm), không kèm codecs=opus
  const rawMime =
    (args.mimeType || mimeFromDataUrl(args.audioBase64, "audio/webm"))
      .split(";")[0]
      .trim() || "audio/webm";
  const mime = rawMime.startsWith("audio/") ? rawMime : "audio/webm";
  return callGemini({
    systemInstruction: args.systemInstruction
      ? { parts: [{ text: args.systemInstruction }] }
      : undefined,
    contents: [
      {
        role: "user",
        parts: [
          { text: args.prompt },
          {
            inlineData: {
              mimeType: mime,
              data: stripBase64(args.audioBase64),
            },
          },
        ],
      },
    ],
    generationConfig: {
      temperature: 0.1,
      maxOutputTokens: 1024,
    },
  });
}

/** Hội thoại nhiều lượt với Gemini */
export async function generateGeminiChat(
  messages: GeminiChatMessage[],
  options?: { systemInstruction?: string; temperature?: number },
): Promise<string> {
  const contents = messages
    .filter((m) => m.text.trim())
    .map((m) => ({
      role: m.role,
      parts: [{ text: m.text }],
    }));

  if (!contents.length || contents[contents.length - 1].role !== "user") {
    throw new Error("Tin nhắn cuối phải là câu hỏi của người dùng.");
  }

  return callGemini({
    systemInstruction: options?.systemInstruction
      ? { parts: [{ text: options.systemInstruction }] }
      : undefined,
    contents,
    generationConfig: {
      temperature: options?.temperature ?? 0.4,
      maxOutputTokens: 2048,
    },
  });
}
