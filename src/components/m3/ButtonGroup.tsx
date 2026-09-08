"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { m3Rounding } from "./tokens";

type ButtonGroupContextValue = {
  spacing: number;
  clickIndex: number;
  setClickIndex: (index: number) => void;
  register: (el: HTMLElement | null, index: number) => void;
  count: number;
};

const ButtonGroupContext = createContext<ButtonGroupContextValue | null>(null);

export function useButtonGroup() {
  return useContext(ButtonGroupContext);
}

/**
 * M3 Button Group container — port of `ButtonGroup.qml`
 * https://m3.material.io/components/button-groups/overview
 */
export function M3ButtonGroup({
  children,
  spacing = 5,
  padding = 0,
  className,
  style,
}: {
  children: ReactNode;
  spacing?: number;
  padding?: number;
  className?: string;
  style?: CSSProperties;
}) {
  const [clickIndex, setClickIndex] = useState(-1);
  const items = useMemo(() => {
    const arr: ReactNode[] = [];
    // count from children
    return arr;
  }, []);
  void items;

  const childArray = Array.isArray(children) ? children : [children];
  const count = childArray.filter(Boolean).length;

  const register = useCallback((_el: HTMLElement | null, _index: number) => {}, []);

  const value = useMemo(
    () => ({
      spacing,
      clickIndex,
      setClickIndex,
      register,
      count,
    }),
    [spacing, clickIndex, register, count],
  );

  return (
    <ButtonGroupContext.Provider value={value}>
      <div
        role="group"
        className={className}
        style={{
        display: "inline-flex",
          flexWrap: "nowrap",
          alignItems: "stretch",
          gap: spacing,
          padding,
          borderRadius: m3Rounding.normal,
          background: "transparent",
          ...style,
        }}
      >
        {childArray.map((child, index) => (
          <ButtonGroupItemIndex key={index} index={index}>
            {child}
          </ButtonGroupItemIndex>
        ))}
      </div>
    </ButtonGroupContext.Provider>
  );
}

const ItemIndexContext = createContext(0);

function ButtonGroupItemIndex({
  index,
  children,
}: {
  index: number;
  children: ReactNode;
}) {
  return (
    <ItemIndexContext.Provider value={index}>{children}</ItemIndexContext.Provider>
  );
}

export function useButtonGroupIndex() {
  return useContext(ItemIndexContext);
}
