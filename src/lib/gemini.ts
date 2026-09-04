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
              mimeType: args.mimeType || "image/jpeg",
              data: args.imageBase64.replace(/^data:[^;]+;base64,/, ""),
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
