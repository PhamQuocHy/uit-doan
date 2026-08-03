"use client";

import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";
import { clsx } from "clsx";

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  total: number;
  limit: number;
  onPageChange: (page: number) => void;
}

export default function Pagination({
  currentPage,
  totalPages,
  total,
  limit,
  onPageChange,
}: PaginationProps) {
  const start = (currentPage - 1) * limit + 1;
  const end = Math.min(currentPage * limit, total);

  const getPages = () => {
    const pages: (number | "...")[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (currentPage > 3) pages.push("...");
      for (
        let i = Math.max(2, currentPage - 1);
        i <= Math.min(totalPages - 1, currentPage + 1);
        i++
      ) {
        pages.push(i);
      }
      if (currentPage < totalPages - 2) pages.push("...");
      pages.push(totalPages);
    }
    return pages;
  };

  return (
    <div className="flex items-center justify-between px-1 py-1">
      <p className="text-[14px] font-medium text-[#6e6e73]">
        Hiển thị{" "}
        <span className="font-bold text-[#1d1d1f]">
          {start}-{end}
        </span>{" "}
        trong <span className="font-bold text-[#1d1d1f]">{total}</span> kết quả
      </p>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onPageChange(1)}
          disabled={currentPage === 1}
          className="rounded-[12px] p-2 text-[#1d1d1f] transition-colors hover:bg-black/[0.04] disabled:cursor-not-allowed disabled:opacity-30"
        >
          <ChevronsLeft size={20} />
        </button>
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="rounded-[12px] p-2 text-[#1d1d1f] transition-colors hover:bg-black/[0.04] disabled:cursor-not-allowed disabled:opacity-30"
        >
          <ChevronLeft size={20} />
        </button>
        {getPages().map((page, idx) =>
          page === "..." ? (
            <span key={`dot-${idx}`} className="px-2 py-1 text-[15px] text-[#aeaeb2]">
              ...
            </span>
          ) : (
            <button
              key={page}
              onClick={() => onPageChange(page as number)}
              className={clsx(
                "h-10 w-10 rounded-[12px] text-[15px] font-bold transition-colors",
                currentPage === page
                  ? "bg-[#007aff] text-white shadow-sm shadow-blue-500/25"
                  : "text-[#1d1d1f] hover:bg-black/[0.04]",
              )}
            >
              {page}
            </button>
          ),
        )}
        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="rounded-[12px] p-2 text-[#1d1d1f] transition-colors hover:bg-black/[0.04] disabled:cursor-not-allowed disabled:opacity-30"
        >
          <ChevronRight size={20} />
        </button>
        <button
          onClick={() => onPageChange(totalPages)}
          disabled={currentPage === totalPages}
          className="rounded-[12px] p-2 text-[#1d1d1f] transition-colors hover:bg-black/[0.04] disabled:cursor-not-allowed disabled:opacity-30"
        >
          <ChevronsRight size={20} />
        </button>
      </div>
    </div>
  );
}
