import type { HumanCheck } from "@/lib/human-check";

export default function HumanCheckNotice({ review }: { review?: HumanCheck }) {
  if (!review?.required) return null;
  return <div role="alert" className="my-2 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">
    <strong>Cán bộ quản lý — cần kiểm tra thủ công</strong>
    <ul className="mt-1 list-disc pl-5">{review.reasons.map((reason, index) => <li key={index}>{reason}</li>)}</ul>
    <p className="mt-1">Đối chiếu hồ sơ và minh chứng trước khi quyết định. Điểm tin cậy chỉ mang tính tham khảo.</p>
  </div>;
}
