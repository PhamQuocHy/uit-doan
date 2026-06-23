import { X, ArrowRight, Printer } from "lucide-react";
import { Citizen } from "@/lib/data";

interface CitizenDetailModalProps {
  citizen: Citizen | null;
  onClose: () => void;
}

export default function CitizenDetailModal({
  citizen,
  onClose,
}: CitizenDetailModalProps) {
  if (!citizen) return null;

  const renderRow = (label: string, value: string | undefined | null) => (
    <div className="flex flex-col sm:flex-row gap-1.5 sm:gap-4 py-3 sm:py-3.5 border-b border-gray-100 last:border-0 hover:bg-gray-50/50 transition-colors px-1 sm:px-2 items-center">
      <div className="sm:w-2/5 md:w-1/3 shrink-0">
        <span className="text-[15px] sm:text-base font-medium text-gray-500">
          {label}:
        </span>
      </div>
      <div className="sm:w-3/5 md:w-2/3">
        <span className="text-[16px] sm:text-base text-gray-900 font-medium wrap-break-word leading-relaxed">
          {value || "—"}
        </span>
      </div>
    </div>
  );

  const SectionHeader = ({ title }: { title: string }) => (
    <div className="mt-8 mb-2 border-b border-gray-200 pb-2 flex items-center gap-2">
      <div className="w-1 h-5 bg-olive-500 rounded-sm"></div>
      <h4 className="text-lg sm:text-[19px] font-semibold text-olive-800">
        {title}
      </h4>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-gray-900/60 backdrop-blur-sm">
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[95vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header - Simple and clean */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-gray-100 bg-[#fbfcf8]">
          <div className="flex items-center gap-3">
            {/* Small line decoration indicating formal doc */}
            <h2 className="text-xl sm:text-2xl font-semibold text-olive-800 tracking-tight">
              Thông tin định danh công dân
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content Body */}
        <div className="sm:pt-4 overflow-y-auto custom-scrollbar flex-1 bg-white">
          <div className="max-w-[600px] mx-auto p-4 sm:p-0">
            <div className="space-y-0 text-left bg-white pb-6 pt-2">
              {/* Avatar Section */}
              <div className="flex flex-col items-center justify-center mb-8">
                <div className="relative">
                  <div className="w-40 h-56 flex items-center justify-center bg-gray-100 border border-gray-200 rounded-md overflow-hidden">
                    {/* Placeholder for actual avatar - ideally this uses citizen.avatarUrl */}
                    <img
                      src={`https://ui-avatars.com/api/?name=${encodeURIComponent(citizen.fullName)}&background=748c2c&color=fff&size=150&font-size=0.33`}
                      alt={`Ảnh chân dung ${citizen.fullName}`}
                      className="w-full h-full object-cover"
                    />
                  </div>
                </div>
              </div>

              <SectionHeader title="Thông tin chung" />
              {renderRow("Họ và tên", citizen.fullName)}
              {renderRow("Số CCCD", citizen.cccd)}
              {renderRow(
                "Ngày sinh",
                new Date(citizen.dateOfBirth).toLocaleDateString("vi-VN"),
              )}
              {renderRow("Giới tính", citizen.gender === "male" ? "Nam" : "Nữ")}
              {renderRow("Đặc điểm nhận dạng", citizen.identificationFeatures)}
              {renderRow(
                "Ngày cấp",
                citizen.issueDate
                  ? new Date(citizen.issueDate).toLocaleDateString("vi-VN")
                  : undefined,
              )}
              {renderRow(
                "Ngày hết hạn",
                citizen.expiryDate
                  ? new Date(citizen.expiryDate).toLocaleDateString("vi-VN")
                  : undefined,
              )}
              {renderRow("Số CMND/CCCD cũ", citizen.oldIdNumber)}

              <SectionHeader title="Về nhân thân" />
              {renderRow("Quốc tịch", citizen.nationality || "Việt Nam")}
              {renderRow("Dân tộc", citizen.ethnicity || "Kinh")}
              {renderRow("Tôn giáo", citizen.religion || "Không")}
              {renderRow("Họ tên cha", citizen.fatherName)}
              {renderRow("Họ tên mẹ", citizen.motherName)}

              <SectionHeader title="Thông tin cư trú & Liên hệ" />
              {renderRow("Quê quán", citizen.originPlace)}
              {renderRow("Nơi thường trú", citizen.address)}
              {renderRow("Số điện thoại", citizen.phone)}
              {renderRow(
                "Đơn vị",
                "0294CF046F990000", // Hardcoded to match the DTT/Trường 15 value in screenshot
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 sm:p-5 border-t border-gray-100 bg-[#fbfcf8] flex justify-between items-center gap-3">
          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 px-4 py-2 text-olive-600 hover:bg-olive-50 rounded-xl text-sm font-semibold transition-colors"
          >
            <Printer size={16} />
            <span className="hidden sm:inline">In hồ sơ</span>
          </button>

          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-5 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-sm font-bold transition-colors"
            >
              Quay lại
            </button>
            <button
              onClick={() => {}}
              className="flex items-center gap-2 px-5 py-2 bg-olive-600 hover:bg-olive-700 text-white rounded-xl text-sm font-bold transition-colors shadow-sm"
            >
              Tiếp tục <ArrowRight size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
