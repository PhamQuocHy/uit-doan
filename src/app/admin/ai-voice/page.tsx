"use client";

import { useState, useRef } from "react";
import {
  Mic,
  Square,
  Save,
  Loader2,
  Volume2,
  CheckCircle2,
  UserPlus,
} from "lucide-react";

export default function AIVoicePage() {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [parsedData, setParsedData] = useState<any>(null);
  const [saved, setSaved] = useState(false);

  // Mock Voice Recording flow
  const handleStartRecording = () => {
    setIsRecording(true);
    setTranscript("");
    setParsedData(null);
    setSaved(false);
  };

  const handleStopRecording = () => {
    setIsRecording(false);
    setIsProcessing(true);
    setTranscript(
      "Căn cước công dân số không bảy chín không chín tám không một hai ba bốn lăm. Họ và tên Nguyễn Văn Nam. Sinh ngày mười lăm tháng mười năm hai ngàn lẻ lăm. Giới tính Nam. Quê quán Phường Bến Nghé Quận Một Thành phố Hồ Chí Minh. Nơi thường trú Phường mười bốn Quận Bình Thạnh Thành phố Hồ Chí Minh.",
    );

    // Simulate AI processing time
    setTimeout(() => {
      setIsProcessing(false);
      setParsedData({
        cccd: "079098012345",
        fullName: "Nguyễn Văn Nam",
        dateOfBirth: "15/10/2005",
        gender: "Nam",
        hometown: "Phường Bến Nghé, Quận 1, TP Hồ Chí Minh",
        address: "Phường 14, Quận Bình Thạnh, TP Hồ Chí Minh",
      });
    }, 2000);
  };

  const handleSave = () => {
    setSaved(true);
    // In a real app, send parsedData to the API
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "#1d1d1f" }}>
            Nhận dạng giọng nói (AI Voice)
          </h1>
          <p className="text-sm mt-1" style={{ color: "#007aff" }}>
            Đọc thông tin CCCD hoặc nộp file ghi âm để hệ thống tự động bóc tách
            dữ liệu
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recording Panel */}
        <div className="bg-white rounded-2xl border border-[#e5e5ea] shadow-sm overflow-hidden flex flex-col">
          <div className="p-6 border-b border-[#e5e5ea] bg-[#f5f5f7]/30 flex flex-col items-center justify-center min-h-[300px]">
            <div className="relative flex items-center justify-center mb-8">
              {isRecording && (
                <>
                  <div className="absolute w-32 h-32 bg-red-100 rounded-full animate-ping opacity-75"></div>
                  <div className="absolute w-24 h-24 bg-red-200 rounded-full animate-pulse opacity-75"></div>
                </>
              )}

              {!isRecording ? (
                <button
                  onClick={handleStartRecording}
                  disabled={isProcessing}
                  className="w-20 h-20 bg-[#007aff] hover:bg-[#636366] text-white rounded-full flex items-center justify-center shadow-lg transition-all hover:scale-105 disabled:opacity-50 disabled:hover:scale-100 z-10"
                >
                  <Mic size={32} />
                </button>
              ) : (
                <button
                  onClick={handleStopRecording}
                  className="w-20 h-20 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center shadow-lg transition-all hover:scale-105 z-10"
                >
                  <Square size={24} fill="currentColor" />
                </button>
              )}
            </div>

            <div className="text-center">
              {isRecording ? (
                <div>
                  <h3 className="text-lg font-bold text-red-500 mb-1">
                    Đang ghi âm...
                  </h3>
                  <p className="text-sm text-gray-500">
                    Hãy đọc rõ ràng từng thông tin trên CCCD
                  </p>
                </div>
              ) : isProcessing ? (
                <div className="flex flex-col items-center">
                  <Loader2
                    className="animate-spin text-[#007aff] mb-2"
                    size={28}
                  />
                  <h3 className="text-lg font-bold text-[#636366]">
                    AI đang phân tích giọng nói...
                  </h3>
                </div>
              ) : (
                <div>
                  <h3 className="text-lg font-bold text-gray-800 mb-1">
                    Nhấn để bắt đầu
                  </h3>
                  <p className="text-sm text-gray-500">
                    Hỗ trợ nhận diện giọng nói cả 3 miền
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="p-6 flex-1 bg-gray-50/50">
            <h4 className="flex items-center gap-2 text-sm font-bold text-gray-700 mb-3">
              <Volume2 size={16} />
              Văn bản trích xuất (Transcript)
            </h4>
            <div className="bg-white p-4 rounded-xl border border-gray-200 min-h-[100px] text-sm text-gray-600 leading-relaxed shadow-inner">
              {transcript ? (
                transcript
              ) : (
                <span className="text-gray-400 italic">
                  Văn bản nhận dạng sẽ hiển thị ở đây...
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Result Panel */}
        <div className="bg-white rounded-2xl border border-[#e5e5ea] shadow-sm flex flex-col relative overflow-hidden">
          {saved && (
            <div className="absolute inset-0 bg-white/80 backdrop-blur-sm z-20 flex flex-col items-center justify-center">
              <div className="bg-green-50 text-green-600 p-4 rounded-full mb-4">
                <CheckCircle2 size={48} />
              </div>
              <h3 className="text-xl font-bold text-green-700 mb-2">
                Đã lưu hồ sơ thành công!
              </h3>
              <p className="text-gray-600 text-sm">
                Công dân Nguyễn Văn Nam đã được thêm vào hệ thống.
              </p>
              <button
                onClick={() => {
                  setSaved(false);
                  setParsedData(null);
                  setTranscript("");
                }}
                className="mt-6 px-6 py-2 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 rounded-xl font-medium transition-colors"
              >
                Nhập hồ sơ mới
              </button>
            </div>
          )}

          <div className="p-4 border-b border-[#e5e5ea] bg-[#f5f5f7]/50 flex justify-between items-center">
            <h3 className="font-bold text-[#636366]">Kết quả Bóc tách (NER)</h3>
            {parsedData && !saved && (
              <button
                onClick={handleSave}
                className="flex items-center gap-2 px-4 py-1.5 bg-[#007aff] hover:bg-[#636366] text-white rounded-lg text-sm font-medium transition-colors shadow-sm"
              >
                <Save size={16} />
                Lưu hồ sơ
              </button>
            )}
          </div>

          <div className="p-6 flex-1">
            {!parsedData && !isProcessing && (
              <div className="h-full flex flex-col items-center justify-center text-gray-400 gap-3">
                <UserPlus size={48} className="opacity-20" />
                <p className="text-sm">
                  Chưa có dữ liệu. Hãy ghi âm để AI bóc tách.
                </p>
              </div>
            )}

            {isProcessing && (
              <div className="h-full flex flex-col items-center justify-center gap-4">
                <div className="w-full max-w-sm space-y-4">
                  <div className="h-10 bg-gray-100 rounded animate-pulse w-full"></div>
                  <div className="h-10 bg-gray-100 rounded animate-pulse w-3/4"></div>
                  <div className="h-10 bg-gray-100 rounded animate-pulse w-5/6"></div>
                  <div className="h-10 bg-gray-100 rounded animate-pulse w-full"></div>
                </div>
              </div>
            )}

            {parsedData && !isProcessing && (
              <div className="space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-gray-500">
                      Số CCCD / Định danh
                    </label>
                    <input
                      type="text"
                      value={parsedData.cccd}
                      readOnly
                      className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm font-mono text-gray-900 focus:outline-none focus:border-[#007aff]"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-gray-500">
                      Họ và Tên
                    </label>
                    <input
                      type="text"
                      value={parsedData.fullName}
                      className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm font-bold text-gray-900 focus:outline-none focus:border-[#007aff]"
                      onChange={(e) =>
                        setParsedData({
                          ...parsedData,
                          fullName: e.target.value,
                        })
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-gray-500">
                      Ngày sinh
                    </label>
                    <input
                      type="text"
                      value={parsedData.dateOfBirth}
                      className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:border-[#007aff]"
                      onChange={(e) =>
                        setParsedData({
                          ...parsedData,
                          dateOfBirth: e.target.value,
                        })
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-gray-500">
                      Giới tính
                    </label>
                    <select
                      value={parsedData.gender}
                      className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:border-[#007aff]"
                      onChange={(e) =>
                        setParsedData({ ...parsedData, gender: e.target.value })
                      }
                    >
                      <option value="Nam">Nam</option>
                      <option value="Nữ">Nữ</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-500">
                    Quê quán
                  </label>
                  <input
                    type="text"
                    value={parsedData.hometown}
                    className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:border-[#007aff]"
                    onChange={(e) =>
                      setParsedData({ ...parsedData, hometown: e.target.value })
                    }
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-500">
                    Nơi thường trú
                  </label>
                  <textarea
                    value={parsedData.address}
                    rows={2}
                    className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:border-[#007aff]"
                    onChange={(e) =>
                      setParsedData({ ...parsedData, address: e.target.value })
                    }
                  />
                </div>

                <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 flex gap-3 text-sm text-blue-800">
                  <div className="shrink-0 mt-0.5">ℹ️</div>
                  <p>
                    AI đã tự động chuẩn hóa địa chỉ theo hệ thống địa giới hành
                    chính. Vui lòng kiểm tra lại trước khi lưu.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
