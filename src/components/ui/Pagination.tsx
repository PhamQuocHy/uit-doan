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

  const navBtn =
    "rounded-full p-2 text-m3-on-surface transition-colors duration-200 " +
    "hover:bg-m3-on-surface/8 disabled:cursor-not-allowed disabled:opacity-30";

  return (
    <div className="flex items-center justify-between px-1 py-1">
      <p className="text-[14px] font-medium text-m3-on-surface-variant">
        Hiển thị{" "}
        <span className="font-bold text-m3-on-surface">
          {start}-{end}
        </span>{" "}
        trong <span className="font-bold text-m3-on-surface">{total}</span> kết quả
      </p>
      <div className="flex items-center gap-1">
        <button onClick={() => onPageChange(1)} disabled={currentPage === 1} className={navBtn}>
          <ChevronsLeft size={20} />
        </button>
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className={navBtn}
        >
          <ChevronLeft size={20} />
        </button>
        {getPages().map((page, idx) =>
          page === "..." ? (
            <span key={`dot-${idx}`} className="px-2 py-1 text-[15px] text-m3-outline">
              ...
            </span>
          ) : (
            <button
              key={page}
              onClick={() => onPageChange(page as number)}
              className={clsx(
                "h-10 min-w-10 rounded-full px-2 text-[15px] font-bold transition-[background-color,color] duration-200 ease-[cubic-bezier(0.34,0.8,0.34,1)]",
                currentPage === page
                  ? "bg-m3-primary text-m3-on-primary"
                  : "text-m3-on-surface hover:bg-m3-on-surface/8",
              )}
            >
              {page}
            </button>
          ),
        )}
        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className={navBtn}
        >
          <ChevronRight size={20} />
        </button>
        <button
          onClick={() => onPageChange(totalPages)}
          disabled={currentPage === totalPages}
          className={navBtn}
        >
          <ChevronsRight size={20} />
        </button>
      </div>
    </div>
  );
}
