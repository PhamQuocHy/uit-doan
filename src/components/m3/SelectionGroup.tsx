"use client";

import {
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { M3ButtonGroup } from "./ButtonGroup";
import { M3GroupButton } from "./GroupButton";
import { useM3Theme } from "./M3ThemeProvider";
import { m3Curves, m3Duration, m3FontSize, m3Rounding, withAlpha } from "./tokens";

export type M3SelectionOption<T extends string | number = string> = {
  value: T;
  label: string;
  icon?: ReactNode;
};

type Props<T extends string | number> = {
  options: readonly M3SelectionOption<T>[];
  value: T;
  onChange: (value: T) => void;
  /** Gap between segments — ConfigSelectionArray uses 2 */
  spacing?: number;
  className?: string;
  style?: CSSProperties;
  disabled?: boolean;
  /** Padding trái/phải mỗi nút. @default 12 */
  horizontalPadding?: number;
  /** Cỡ chữ nhãn. @default 15 */
  fontSize?: number;
  /**
   * Số tab hiện trong viewport. Từ tab thứ (visibleCount + 1) trở đi thì cuộn ngang.
   * Khi chọn tab gần mép phải, tự kéo sang để lộ tab tiếp theo.
   */
  visibleCount?: number;
  /** Căng đều các tab theo chiều ngang container. @default false */
  fullWidth?: boolean;
};

/**
 * Connected pill selection group — port of
 * `SelectionGroupButton.qml` + `ConfigSelectionArray.qml`.
 *
 * Shape morph (M3 Expressive):
 * - Selected (or end) segment → full pill radius (height/2)
 * - Unselected middle → unsharpenmore (6px)
 * Overall track reads as an incomplete / connected pill.
 */
export function M3SelectionGroup<T extends string | number>({
  options,
  value,
  onChange,
  spacing = 2,
  className,
  style,
  disabled,
  horizontalPadding = 12,
  fontSize = m3FontSize.small,
  visibleCount,
  fullWidth = false,
}: Props<T>) {
  const { palette } = useM3Theme();
  const [heights, setHeights] = useState<Record<number, number>>({});
  const scrollerRef = useRef<HTMLDivElement>(null);

  const setHeight = useCallback((index: number, h: number) => {
    setHeights((prev) => (prev[index] === h ? prev : { ...prev, [index]: h }));
  }, []);

  const enableScroll =
    typeof visibleCount === "number" && visibleCount > 0 && options.length > visibleCount;
  const stretch = fullWidth && options.length > 0;
  const visible = visibleCount && visibleCount > 0 ? visibleCount : options.length;

  const measureVisibleWidth = useCallback(() => {
    const scroller = scrollerRef.current;
    if (!scroller || !enableScroll || !visibleCount || stretch) return;
    const buttons = [...scroller.querySelectorAll<HTMLElement>("button")];
    if (buttons.length === 0) return;
    const count = Math.min(visibleCount, buttons.length);
    const first = buttons[0];
    const lastVisible = buttons[count - 1];
    let width = lastVisible.offsetLeft + lastVisible.offsetWidth - first.offsetLeft;

    // Hiện nhô ra 0.45 tab tiếp theo (thành ~4.5 tab) để người dùng thấy còn tab nữa
    if (buttons.length > visibleCount && buttons[visibleCount]) {
      const nextTab = buttons[visibleCount];
      const peekWidth = Math.round(nextTab.offsetWidth * 0.45);
      width += spacing + peekWidth;
    }

    scroller.style.width = `${Math.ceil(width)}px`;
    scroller.style.maxWidth = "100%";
  }, [enableScroll, visibleCount, options.length, stretch, spacing]);

  const didInitScroll = useRef(false);

  useLayoutEffect(() => {
    measureVisibleWidth();
    if (!didInitScroll.current) {
      const scroller = scrollerRef.current;
      if (scroller) scroller.scrollLeft = 0;
      didInitScroll.current = true;
    }
  }, [measureVisibleWidth, options.length]);

  const isDragging = useRef(false);
  const hasDragged = useRef(false);
  const startX = useRef(0);
  const scrollLeftStart = useRef(0);

  const handleMouseDown = (e: React.MouseEvent) => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    isDragging.current = true;
    hasDragged.current = false;
    startX.current = e.clientX;
    scrollLeftStart.current = scroller.scrollLeft;
  };

  const handleMouseLeaveOrUp = () => {
    isDragging.current = false;
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging.current) return;
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const deltaX = e.clientX - startX.current;
    if (Math.abs(deltaX) > 16) {
      hasDragged.current = true;
    }
    if (hasDragged.current) {
      e.preventDefault();
      scroller.scrollLeft = scrollLeftStart.current - deltaX * 1.2;
    }
  };

  const handleTabClick = useCallback(
    (index: number, optValue: T) => {
      if (hasDragged.current) {
        hasDragged.current = false;
        return;
      }
      onChange(optValue);

      const scroller = scrollerRef.current;
      if (!scroller || !enableScroll) return;

      const buttons = [...scroller.querySelectorAll<HTMLElement>("button")];
      if (!buttons.length) return;

      const contentLeft = (btn: HTMLElement) =>
        btn.getBoundingClientRect().left -
        scroller.getBoundingClientRect().left +
        scroller.scrollLeft;

      const visCount = visibleCount || 4;
      const edge = scroller.scrollLeft + 12;
      let first = 0;
      for (let i = 0; i < buttons.length; i++) {
        if (contentLeft(buttons[i]) + buttons[i].offsetWidth * 0.55 > edge) {
          first = i;
          break;
        }
      }
      const lastFull = Math.min(first + visCount - 1, buttons.length - 1);

      let newFirst: number | null = null;
      if (index <= first && first > 0) {
        newFirst = first - 1;
      } else if (index >= lastFull && index < buttons.length - 1) {
        newFirst = Math.min(first + 1, buttons.length - 1);
      }
      if (newFirst === null) return;

      const left = contentLeft(buttons[newFirst]);
      requestAnimationFrame(() => {
        scroller.scrollTo({ left, behavior: "smooth" });
      });
    },
    [enableScroll, onChange, visibleCount],
  );

  const groupStyle: CSSProperties = stretch
    ? {
        display: "flex",
        width: enableScroll ? `${(options.length / visible) * 100}%` : "100%",
      }
    : enableScroll
      ? {
          display: "inline-flex",
          width: "max-content",
          marginLeft: 0,
          marginRight: 0,
        }
      : {};

  const group = (
    <M3ButtonGroup
      spacing={spacing}
      className={enableScroll ? undefined : className}
      style={{
        ...(enableScroll || stretch ? undefined : style),
        ...groupStyle,
      }}
    >
      {options.map((opt, index) => {
        const toggled = value === opt.value;
        const leftmost = index === 0;
        const rightmost = index === options.length - 1;
        const h = heights[index] || 40;
        const pill = h / 2;
        const leftRadius =
          toggled || leftmost ? pill : m3Rounding.unsharpenmore;
        const rightRadius =
          toggled || rightmost ? pill : m3Rounding.unsharpenmore;

        return (
          <M3GroupButton
            key={String(opt.value)}
            bounce={false}
            toggled={toggled}
            disabled={disabled}
            leftRadius={leftRadius}
            rightRadius={rightRadius}
            horizontalPadding={horizontalPadding}
            verticalPadding={8}
            colBackground={withAlpha(palette.colOnSurface, 0.06)}
            colBackgroundHover={withAlpha(palette.colOnSurface, 0.09)}
            colBackgroundActive={withAlpha(palette.colOnSurface, 0.12)}
            colBackgroundToggled={palette.colPrimary}
            colBackgroundToggledHover={palette.colPrimaryHover}
            colBackgroundToggledActive={palette.colPrimaryActive}
            onClick={() => {
              handleTabClick(index, opt.value);
            }}
            ref={(el) => {
              if (el) setHeight(index, el.offsetHeight);
            }}
            style={{
              color: toggled
                ? palette.colOnPrimary
                : palette.colOnLayer1,
              fontSize,
              gap: opt.icon ? 4 : 0,
              whiteSpace: "nowrap",
              flexShrink: stretch ? 1 : 0,
              ...(stretch
                ? {
                    flex: 1,
                    minWidth: 0,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }
                : null),
            }}
          >
            {opt.icon}
            {opt.label}
          </M3GroupButton>
        );
      })}
    </M3ButtonGroup>
  );

  if (!enableScroll) return group;

  return (
    <div
      ref={scrollerRef}
      className={className}
      role="tablist"
      data-m3-sel-scroll=""
      onMouseDown={handleMouseDown}
      onMouseLeave={handleMouseLeaveOrUp}
      onMouseUp={handleMouseLeaveOrUp}
      onMouseMove={handleMouseMove}
      style={{
        overflowX: "auto",
        overflowY: "hidden",
        display: "block",
        direction: "ltr",
        textAlign: "left",
        cursor: "grab",
        userSelect: "none",
        width: "100%",
        maxWidth: "100%",
        minWidth: 0,
        scrollbarWidth: "none",
        msOverflowStyle: "none",
        WebkitOverflowScrolling: "touch",
        ...style,
      }}
    >
      <style>{`[data-m3-sel-scroll]::-webkit-scrollbar{display:none}`}</style>
      {group}
    </div>
  );
}

/**
 * Alias for selection group used as morphing pill tabs.
 */
export function M3PillTabBar<T extends string | number>(props: Props<T>) {
  return (
    <div
      role="tablist"
      style={{
        display: "inline-flex",
        alignItems: "center",
        transition: `gap ${m3Duration.expressiveEffects}ms ${m3Curves.expressiveEffects}`,
      }}
    >
      <M3SelectionGroup {...props} />
    </div>
  );
}
