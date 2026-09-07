import type { ReactNode } from "react";

type PageHeaderProps = {
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  children?: ReactNode;
};

/** Page title block matching Hồ sơ công dân: 22px bold title, gray subtitle, pill CTA. */
export default function PageHeader({
  title,
  description,
  action,
  children,
}: PageHeaderProps) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-[22px] font-bold tracking-tight text-m3-on-surface">
          {title}
        </h1>
        {description ? (
          <div className="mt-1.5 text-[14px] text-m3-on-surface-variant">
            {description}
          </div>
        ) : null}
        {children}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
