"use client";

import {
  forwardRef,
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { useIsMobile } from "./useIsMobile";
import { useM3Theme } from "./M3ThemeProvider";
import { useRipple, withRippleHostStyle } from "./useRipple";
import {
  m3Curves,
  m3Duration,
  m3FontSize,
  m3Rounding,
  withAlpha,
} from "./tokens";

export type M3TabItem<T extends string = string> = {
  id: T;
  label: string;
  icon?: ReactNode;
};

type Props<T extends string> = {
  tabs: readonly M3TabItem<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
  style?: CSSProperties;
  /** Indicator side padding — SecondaryTabBar.qml default 8 */
  indicatorPadding?: number;
  /**
   * fixed = chia đều chiều ngang; scrollable = ôm chữ, kéo ngang khi nhiều tab.
   * @default "scrollable"
   */
  variant?: "fixed" | "scrollable";
  /** Hide built-in baseline if parent container already has a borderBottom line */
  hideBaseline?: boolean;
  /** Padding mỗi tab. @default "10px 16px" */
  tabPadding?: string;
  /** Chiều cao tối thiểu mỗi tab. @default 44 */
  minHeight?: number;
  /** Cỡ chữ nhãn tab. @default m3FontSize.normal */
  fontSize?: number;
  /**
   * Số tab đầy đủ trong khung. Tab tiếp theo nhô ~45% để biết còn tab.
   * Chỉ áp dụng khi variant="scrollable".
   */
  visibleCount?: number;
  /** Giới hạn chiều rộng tối đa của mỗi nút tab. @default { xs: 130, sm: 200 } */
  tabMaxWidth?: number | string | Record<string, any>;
};

/**
 * Secondary tab bar with morphing bottom indicator —
 * port of `SecondaryTabBar.qml` + `SecondaryTabButton.qml`
 */
export function M3SecondaryTabBar<T extends string>({
  tabs,
  value,
  onChange,
  className,
  style,
  indicatorPadding = 8,
  variant = "scrollable",
  hideBaseline = false,
  tabPadding = "10px 16px",
  minHeight = 44,
  fontSize = m3FontSize.normal,
  visibleCount,
  tabMaxWidth,
}: Props<T>) {
  const isMobile = useIsMobile();

  let resolvedTabMaxWidth: number | string = isMobile ? 130 : 200;
  if (typeof tabMaxWidth === "number" || typeof tabMaxWidth === "string") {
    resolvedTabMaxWidth = tabMaxWidth;
  } else if (tabMaxWidth && typeof tabMaxWidth === "object") {
    if (isMobile && "xs" in tabMaxWidth) {
      resolvedTabMaxWidth = tabMaxWidth.xs;
    } else if (!isMobile && "sm" in tabMaxWidth) {
      resolvedTabMaxWidth = tabMaxWidth.sm;
    } else if ("xs" in tabMaxWidth) {
      resolvedTabMaxWidth = tabMaxWidth.xs;
    }
  }

  const { palette } = useM3Theme();
  const listRef = useRef<HTMLDivElement>(null);
  const btnRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [indicator, setIndicator] = useState({ left: 0, width: 0 });
  const prevIndex = useRef(0);
  const didInitScroll = useRef(false);
  const isDragging = useRef(false);
  const hasDragged = useRef(false);
  const startX = useRef(0);
  const scrollLeftStart = useRef(0);
  const scrollable = variant === "scrollable";
  const enablePeek =
    scrollable &&
    typeof visibleCount === "number" &&
    visibleCount > 0 &&
    tabs.length > visibleCount;

  const currentIndex = Math.max(
    0,
    tabs.findIndex((t) => t.id === value),
  );

  const measurePeekWidth = useCallback(() => {
    const list = listRef.current;
    if (!list || !enablePeek || !visibleCount) {
      if (list && scrollable) list.style.maxWidth = "100%";
      return;
    }
    const buttons = btnRefs.current.filter(Boolean) as HTMLButtonElement[];
    if (buttons.length <= visibleCount) return;
    const first = buttons[0];
    const lastFull = buttons[visibleCount - 1];
    const peek = buttons[visibleCount];
    let width = lastFull.offsetLeft + lastFull.offsetWidth - first.offsetLeft;
    if (peek) width += Math.round(peek.offsetWidth * 0.45);
    list.style.width = `${Math.ceil(width)}px`;
    list.style.maxWidth = "100%";
  }, [enablePeek, visibleCount, scrollable, tabs.length]);

  useLayoutEffect(() => {
    measurePeekWidth();
    const list = listRef.current;
    if (list && !didInitScroll.current) {
      list.scrollLeft = 0;
      didInitScroll.current = true;
    }
  }, [measurePeekWidth, tabs.length]);

  useLayoutEffect(() => {
    const el = btnRefs.current[currentIndex];
    const list = listRef.current;
    if (!el || !list) return;

    const left = el.offsetLeft + indicatorPadding;
    const width = el.offsetWidth - indicatorPadding * 2;

    const from = prevIndex.current;
    const to = currentIndex;
    if (from !== to) {
      const a = btnRefs.current[Math.min(from, to)];
      const b = btnRefs.current[Math.max(from, to)];
      if (a && b) {
        const stretchLeft = a.offsetLeft + indicatorPadding;
        const stretchRight = b.offsetLeft + b.offsetWidth - indicatorPadding;
        setIndicator({ left: stretchLeft, width: stretchRight - stretchLeft });
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            setIndicator({ left, width });
            prevIndex.current = to;
          });
        });
        return;
      }
    }
    setIndicator({ left, width });
    prevIndex.current = currentIndex;
  }, [currentIndex, tabs, indicatorPadding, value]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!scrollable) return;
    const list = listRef.current;
    if (!list) return;
    isDragging.current = true;
    hasDragged.current = false;
    startX.current = e.clientX;
    scrollLeftStart.current = list.scrollLeft;
  };

  const handleMouseLeaveOrUp = () => {
    isDragging.current = false;
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging.current || !scrollable) return;
    const list = listRef.current;
    if (!list) return;
    const deltaX = e.clientX - startX.current;
    if (Math.abs(deltaX) > 16) hasDragged.current = true;
    if (hasDragged.current) {
      e.preventDefault();
      list.scrollLeft = scrollLeftStart.current - deltaX * 1.2;
    }
  };

  const handleSelect = (index: number, id: T) => {
    if (hasDragged.current) {
      hasDragged.current = false;
      return;
    }
    onChange(id);

    const list = listRef.current;
    if (!list || !scrollable || tabs.length <= (visibleCount || 4)) return;

    const buttons = btnRefs.current.filter(Boolean) as HTMLButtonElement[];
    if (!buttons.length) return;

    const contentLeft = (btn: HTMLElement) =>
      btn.getBoundingClientRect().left -
      list.getBoundingClientRect().left +
      list.scrollLeft;

    const visCount = visibleCount || 4;
    const edge = list.scrollLeft + 12;
    let first = 0;
    for (let i = 0; i < buttons.length; i++) {
      if (contentLeft(buttons[i]) + buttons[i].offsetWidth * 0.55 > edge) {
        first = i;
        break;
      }
    }
    const lastFull = Math.min(first + visCount - 1, buttons.length - 1);
    let newFirst: number | null = null;
    if (index <= first && first > 0) newFirst = first - 1;
    else if (index >= lastFull && index < buttons.length - 1) {
      newFirst = Math.min(first + 1, buttons.length - 1);
    }
    if (newFirst === null) return;
    const left = contentLeft(buttons[newFirst]);
    requestAnimationFrame(() => {
      list.scrollTo({ left, behavior: "smooth" });
    });
  };

  return (
    <div
      className={className}
      style={{
        position: "relative",
        width: enablePeek ? "max-content" : "100%",
        maxWidth: "100%",
        ...style,
      }}
    >
      <style>{`.m3-tablist::-webkit-scrollbar{display:none}`}</style>
      <div
        ref={listRef}
        role="tablist"
        className="m3-tablist"
        onMouseDown={handleMouseDown}
        onMouseLeave={handleMouseLeaveOrUp}
        onMouseUp={handleMouseLeaveOrUp}
        onMouseMove={handleMouseMove}
        style={{
          display: "flex",
          width: enablePeek ? undefined : "100%",
          maxWidth: "100%",
          position: "relative",
          flexWrap: "nowrap",
          overflowX: scrollable ? "auto" : "hidden",
          scrollbarWidth: "none",
          msOverflowStyle: "none",
          cursor: scrollable ? "grab" : undefined,
          userSelect: scrollable ? "none" : undefined,
        }}
      >
        {tabs.map((tab, i) => (
          <TabButton
            key={tab.id}
            ref={(node) => {
              btnRefs.current[i] = node;
            }}
            selected={tab.id === value}
            label={tab.label}
            icon={tab.icon}
            grow={!scrollable}
            padding={tabPadding}
            minHeight={minHeight}
            fontSize={fontSize}
            tabMaxWidth={resolvedTabMaxWidth}
            onSelect={() => handleSelect(i, tab.id)}
          />
        ))}

        <div
          style={{
            position: "absolute",
            bottom: 0,
            height: 3,
            left: indicator.left,
            width: Math.max(0, indicator.width),
            background: palette.colPrimary,
            borderTopLeftRadius: 3,
            borderTopRightRadius: 3,
            pointerEvents: "none",
            transition: [
              `left ${m3Duration.expressiveDefaultSpatial}ms ${m3Curves.expressiveDefaultSpatial}`,
              `width ${m3Duration.expressiveDefaultSpatial}ms ${m3Curves.expressiveDefaultSpatial}`,
            ].join(", "),
            zIndex: 1,
          }}
        />
      </div>

      {!hideBaseline && (
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            height: 1,
            background: withAlpha(palette.colOnSurface, 0.08),
          }}
        />
      )}
    </div>
  );
}

const TabButton = forwardRef<
  HTMLButtonElement,
  {
    selected: boolean;
    label: string;
    icon?: ReactNode;
    grow?: boolean;
    padding?: string;
    minHeight?: number;
    fontSize?: number;
    tabMaxWidth?: number | string;
    onSelect: () => void;
  }
>(function TabButton(
  {
    selected,
    label,
    icon,
    grow = false,
    padding = "10px 16px",
    minHeight = 44,
    fontSize = m3FontSize.normal,
    tabMaxWidth,
    onSelect,
  },
  ref,
) {
  const { palette } = useM3Theme();
  const [hovered, setHovered] = useState(false);
  const { onPointerDown, rippleLayer } = useRipple({
    color: withAlpha(palette.colOnSurface, 0.12),
  });

  const bg = hovered
    ? withAlpha(palette.colOnSurface, selected ? 0 : 0.05)
    : "transparent";

  return (
    <button
      ref={ref}
      type="button"
      role="tab"
      aria-selected={selected}
      onClick={onSelect}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onMouseDown={onPointerDown}
      style={withRippleHostStyle({
        appearance: "none",
        border: 0,
        margin: 0,
        flex: grow ? 1 : "0 0 auto",
        minWidth: grow ? 0 : undefined,
        maxWidth: tabMaxWidth ?? (grow ? "100%" : 130),
        cursor: "pointer",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 5,
        minHeight,
        padding,
        borderRadius: m3Rounding.normal,
        backgroundColor: bg,
        color: selected ? palette.colPrimary : palette.colOnLayer1,
        fontSize,
        fontWeight: 500,
        letterSpacing: 0,
        transition: `background-color ${m3Duration.expressiveEffects}ms ${m3Curves.expressiveEffects}, color ${m3Duration.expressiveEffects}ms ${m3Curves.expressiveEffects}`,
      })}
    >
      {rippleLayer}
      {icon}
      <span
        style={{
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
          maxWidth: "100%",
          display: "block",
        }}
      >
        {label}
      </span>
    </button>
  );
});
