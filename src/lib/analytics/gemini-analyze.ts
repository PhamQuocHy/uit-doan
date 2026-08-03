import type { AnalyticsDashboard } from "./types";
import { generateGeminiText, getGeminiModel } from "@/lib/gemini";

const SYSTEM_INSTRUCTION = `Bạn là chuyên gia phân tích dữ liệu nghĩa vụ quân sự (NVQS) tại Việt Nam.
Trả lời bằng tiếng Việt, ngắn gọn, có cấu trúc markdown.
Tập trung: xu hướng tuyển quân, tắc nghẽn funnel, rủi ro tạm hoãn/miễn, gợi ý hành động cho cấp chỉ huy.
Không bịa số liệu ngoài JSON được cung cấp.`;

function compactDashboardForPrompt(data: AnalyticsDashboard): string {
  return JSON.stringify(
    {
      meta: data.meta,
      overview: data.overview,
      funnel: data.funnel,
      recruitmentStatsByYear: data.recruitmentStatsByYear?.slice(-5),
      defermentReasons: data.defermentReasons?.slice(0, 8),
      unitQualifyRates: data.unitQualifyRates?.slice(0, 10),
      quotas: data.quotas?.slice(0, 8),
    },
    null,
    2,
  );
}

export async function analyzeDashboardWithGemini(
  data: AnalyticsDashboard,
): Promise<{ text: string; model: string }> {
  const prompt = `Phân tích báo cáo NVQS sau và đưa ra nhận định cho lãnh đạo.

Yêu cầu output:
## Tóm tắt điều hành (3-5 bullet)
## Điểm nổi bật
## Rủi ro / điểm cần lưu ý
## Gợi ý hành động (ưu tiên 3 việc)

Dữ liệu JSON:
${compactDashboardForPrompt(data)}`;

  const text = await generateGeminiText(prompt, { systemInstruction: SYSTEM_INSTRUCTION });
  return { text, model: getGeminiModel() };
}
