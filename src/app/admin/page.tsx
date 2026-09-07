import { redirect } from "next/navigation";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import {
  FcConferenceCall,
  FcCalendar,
  FcBullish,
  FcCameraIdentification,
  FcBarChart,
  FcDocument,
  FcHome,
  FcDepartment,
  FcOrganization,
} from "react-icons/fc";
import { getUnitDescendants } from "@/lib/data";
import { getSession } from "@/lib/auth";
import {
  CHILD_LEVEL_LABEL,
  LEVEL_LABEL,
  getBreadcrumb,
  listChildUnits,
  resolveViewUnit,
} from "@/lib/hierarchy";

type Props = {
  searchParams: Promise<{ scope?: string; all?: string }>;
};

const CHILD_PREVIEW = 8;

export default async function AdminDashboard({ searchParams }: Props) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.hierarchyLevel === "donvi") redirect("/admin/receiving");

  const params = await searchParams;
  const viewUnit = resolveViewUnit(
    session.unitCode,
    session.hierarchyLevel,
    params.scope
  );
  const level = viewUnit.level;
  const levelLabel = LEVEL_LABEL[level] || level;
  const childTitle = CHILD_LEVEL_LABEL[level] || "";
  const showAllChildren = params.all === "1";
  const { items: childUnits, total: childTotal } = listChildUnits(
    viewUnit.code,
    showAllChildren ? 9999 : CHILD_PREVIEW
  );
  const childListQs = new URLSearchParams();
  if (viewUnit.code !== session.unitCode) {
    childListQs.set("scope", viewUnit.code);
  }
  const childListBase = childListQs.toString()
    ? `/admin?${childListQs.toString()}`
    : "/admin";
  const childListExpandHref = childListQs.toString()
    ? `${childListBase}&all=1`
    : "/admin?all=1";
  const crumbs = getBreadcrumb(viewUnit.code);
  // Bộ được phép mọi crumb; cấp dưới chỉ trong nhánh của mình
  const allowedScope =
    session.hierarchyLevel === "bo"
      ? null
      : new Set(getUnitDescendants(session.unitCode));

  const shortcuts = shortcutsForLevel(level);

  const LevelIcon =
    level === "bo" ? FcOrganization : level === "tinh" ? FcDepartment : FcHome;

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      {/* Cấp hiện tại */}
      <section className="rounded-[22px] bg-m3-surface-high px-5 py-4.5 sm:px-6 sm:py-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[16px] bg-m3-surface-high">
              <LevelIcon size={32} />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-m3-primary/12 px-3 py-1 text-[13px] font-bold text-m3-primary">
                  Cấp {levelLabel}
                </span>
                {viewUnit.code !== session.unitCode && (
                  <span className="rounded-full bg-m3-surface-high px-3 py-1 text-[12px] font-semibold text-m3-on-surface-variant">
                    Đang xem đơn vị cấp dưới
                  </span>
                )}
              </div>
              <h1 className="mt-1 truncate text-[22px] font-bold tracking-tight text-m3-on-surface sm:text-[24px]">
                {viewUnit.name}
              </h1>
              <p className="truncate text-[15px] font-normal text-m3-on-surface-variant">
                Xin chào {session.name} — làm việc trong phạm vi đơn vị này
              </p>
            </div>
          </div>
        </div>

        {/* Breadcrumb Bộ → Tỉnh → Xã */}
        {crumbs.length > 1 && (
          <nav className="mt-3.5 flex flex-wrap items-center gap-1 border-t border-black/[0.05] pt-3.5 text-[14px]">
            {crumbs.map((c, i) => {
              const href =
                c.code === session.unitCode
                  ? "/admin"
                  : `/admin?scope=${encodeURIComponent(c.code)}`;
              const canClick =
                allowedScope === null || allowedScope.has(c.code);
              const isLast = i === crumbs.length - 1;
              return (
                <span key={c.code} className="flex items-center gap-1">
                  {i > 0 && <ChevronRight size={14} className="text-m3-outline-variant" />}
                  {isLast || !canClick ? (
                    <span className="font-bold text-m3-on-surface">{c.name}</span>
                  ) : (
                    <Link
                      href={href}
                      className="font-semibold text-m3-primary hover:underline"
                    >
                      {c.name}
                    </Link>
                  )}
                </span>
              );
            })}
          </nav>
        )}
      </section>

      {/* Lối tắt */}
      <section>
        
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {shortcuts.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex flex-col items-center justify-center gap-2.5 rounded-[20px] bg-m3-surface-high px-3 py-5 transition-transform hover:-translate-y-0.5 active:scale-[0.98]"
                
              >
                <div className="flex h-14 w-14 items-center justify-center">
                  <Icon size={50} />
                </div>
                <span className="text-center text-[15px] font-normal text-m3-on-surface">
                  {item.label}
                </span>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Danh sách cấp dưới — Bộ / Tỉnh */}
      {childTitle && (
        <section
          className="rounded-[22px] bg-m3-surface-high p-5 sm:p-6"
        
        >
          <div className="mb-3.5 flex items-end justify-between gap-3">
            <div>
              <h2 className="text-[17px] font-bold text-m3-on-surface">{childTitle}</h2>
              
            </div>
            <Link
              href={`/admin/reports?unitCode=${encodeURIComponent(viewUnit.code)}`}
              className="shrink-0 text-[14px] font-normal text-m3-primary"
            >
              Báo cáo chi tiết
            </Link>
          </div>

          {childUnits.length === 0 ? (
            <p className="py-5 text-center text-[15px] text-m3-on-surface-variant">
              Không có đơn vị cấp dưới.
            </p>
          ) : (
            <>
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
                {childUnits.map((u) => (
                  <Link
                    key={u.code}
                    href={`/admin?scope=${encodeURIComponent(u.code)}`}
                    className="flex min-h-[58px] items-center justify-between gap-3 rounded-[16px] bg-m3-surface-lowest px-4 py-3.5 transition-colors hover:bg-m3-primary/8"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-[15px] font-medium text-m3-on-surface">
                        {u.name}
                      </p>
                      <p className="text-[13px] font-normal text-m3-on-surface-variant">
                        {LEVEL_LABEL[u.level]} · mã {u.code}
                      </p>
                    </div>
                    <ChevronRight size={18} className="shrink-0 text-m3-outline-variant" />
                  </Link>
                ))}
              </div>

              {childTotal > CHILD_PREVIEW && (
                <div className="mt-3.5 text-center">
                  <Link
                    href={showAllChildren ? childListBase : childListExpandHref}
                    className="inline-flex min-h-[44px] items-center justify-center rounded-[12px] px-5 text-[15px] font-normal text-m3-primary transition-colors hover:bg-m3-primary/8"
                  >
                    {showAllChildren
                      ? "Thu gọn"
                      : `Xem tất cả (${childTotal})`}
                  </Link>
                </div>
              )}
            </>
          )}
        </section>
      )}

      {/* Cấp xã: không có cấp dưới — nhấn mạnh việc địa phương */}
      {level === "xa" && (
        <section
          className="rounded-[22px] bg-m3-surface-lowest p-5 sm:p-6"
          style={{
            border: "1px solid rgba(0,0,0,0.05)",
            boxShadow: "0 1px 2px rgba(0,0,0,0.02), 0 8px 24px rgba(0,0,0,0.04)",
          }}
        >
          <h2 className="text-[17px] font-bold text-m3-on-surface">Công việc tại xã</h2>
          <p className="mt-1 text-[14px] font-medium text-m3-on-surface-variant">
            Cấp xã quản lý trực tiếp hồ sơ thanh niên trên địa bàn.
          </p>
          <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
            <Link
              href="/admin/citizens"
              className="rounded-[16px] bg-m3-surface-high px-4 py-4 text-[15px] font-bold text-m3-on-surface hover:bg-m3-primary/8"
            >
              Cập nhật danh sách công dân →
            </Link>
            <Link
              href="/admin/ai-face?tab=voice"
              className="rounded-[16px] bg-m3-surface-high px-4 py-4 text-[15px] font-bold text-m3-on-surface hover:bg-m3-primary/8"
            >
              Tra cứu CCCD bằng giọng nói →
            </Link>
          </div>
        </section>
      )}
    </div>
  );
}

function shortcutsForLevel(level: string) {
  const all = [
    { href: "/admin/citizens", label: "Công dân", icon: FcConferenceCall },
    { href: "/admin/recruitment", label: "Khám tuyển", icon: FcCalendar },
    { href: "/admin/quota", label: "Chỉ tiêu", icon: FcBullish },
    {
      href: "/admin/ai-face",
      label: "Khuôn mặt & giọng nói",
      icon: FcCameraIdentification,
    },
    { href: "/admin/reports", label: "Báo cáo", icon: FcBarChart },
    { href: "/admin/documents", label: "Công văn", icon: FcDocument },
  ];

  // Xã: ưu tiên thao tác địa phương, ít mục hơn cho dễ dùng
  if (level === "xa") {
    return all.filter((x) =>
      [
        "/admin/citizens",
        "/admin/ai-face",
        "/admin/documents",
        "/admin/reports",
      ].includes(x.href),
    );
  }
  return all;
}
