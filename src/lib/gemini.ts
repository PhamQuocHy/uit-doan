const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta";

export function getGeminiModel(): string {
  return process.env.GEMINI_MODEL || "gemini-3-flash-preview";
}

export function isGeminiConfigured(): boolean {
  return Boolean(process.env.GEMINI_API_KEY?.trim());
}

export async function generateGeminiText(
  prompt: string,
  options?: { systemInstruction?: string },
): Promise<string> {
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
    body: JSON.stringify({
      systemInstruction: options?.systemInstruction
        ? { parts: [{ text: options.systemInstruction }] }
        : undefined,
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.35,
        maxOutputTokens: 2048,
      },
    }),
  });

  const data = (await res.json()) as {
    error?: { message?: string };
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };

  if (!res.ok) {
    throw new Error(data.error?.message || `Gemini API lỗi (${res.status})`);
  }

  const text = data.candidates?.[0]?.content?.parts
    ?.map((p) => p.text || "")
    .join("")
    .trim();

  if (!text) {
    throw new Error("Gemini không trả về nội dung phân tích.");
  }

  return text;
}
