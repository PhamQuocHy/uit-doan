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
      <p className="text-xs font-semibold" style={{ color: "#748c2c" }}>
        Hiển thị{" "}
        <span className="font-bold" style={{ color: "#3b491e" }}>
          {start}–{end}
        </span>{" "}
        trong{" "}
        <span className="font-bold" style={{ color: "#3b491e" }}>
          {total}
        </span>{" "}
        kết quả
      </p>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onPageChange(1)}
          disabled={currentPage === 1}
          className={clsx(
            "p-1.5 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed",
            "hover:bg-gray-100",
          )}
          style={{ color: "#748c2c" }}
        >
          <ChevronsLeft size={16} />
        </button>
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="p-1.5 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed hover:bg-gray-100"
          style={{ color: "#748c2c" }}
        >
          <ChevronLeft size={16} />
        </button>
        {getPages().map((page, idx) =>
          page === "..." ? (
            <span
              key={`dot-${idx}`}
              className="px-2 py-1 text-slate-400 text-sm"
            >
              ...
            </span>
          ) : (
            <button
              key={page}
              onClick={() => onPageChange(page as number)}
              className={clsx(
                "w-8 h-8 text-sm rounded-lg font-bold transition-colors",
              )}
              style={
                currentPage === page
                  ? {
                      background: "#748c2c",
                      color: "#ffffff",
                      boxShadow: "0 2px 8px rgba(116,140,44,0.2)",
                    }
                  : { color: "#748c2c" }
              }
            >
              {page}
            </button>
          ),
        )}
        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="p-1.5 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed hover:bg-gray-100"
          style={{ color: "#748c2c" }}
        >
          <ChevronRight size={16} />
        </button>
        <button
          onClick={() => onPageChange(totalPages)}
          disabled={currentPage === totalPages}
          className="p-1.5 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed hover:bg-gray-100"
          style={{ color: "#748c2c" }}
        >
          <ChevronsRight size={16} />
        </button>
      </div>
    </div>
  );
}
