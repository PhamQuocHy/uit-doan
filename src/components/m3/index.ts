/**
 * Material 3 Expressive UI kit — spec: https://m3.material.io/components
 *
 * Usage:
 * ```tsx
 * import { M3ThemeProvider, M3SelectionGroup, M3TextField } from "@/components/m3";
 *
 * <M3ThemeProvider mode="light">
 *   <M3SelectionGroup options={...} value={...} onChange={...} />
 * </M3ThemeProvider>
 * ```
 *
 * CSS token side: `--m3-*` vars + Tailwind `m3-*` utilities live in
 * `src/app/globals.css` (`@theme inline` maps them to the palette below).
 */

export {
  m3Dark,
  m3Light,
  m3Rounding,
  m3FontSize,
  m3Curves,
  m3Duration,
  mixColor,
  withAlpha,
  derivePalette,
  withPrimaryAccent,
} from "./tokens";
export type { M3ColorScheme, M3Palette } from "./tokens";

export { M3ThemeProvider, useM3Theme } from "./M3ThemeProvider";
export { useIsMobile } from "./useIsMobile";

export { M3ButtonGroup, useButtonGroup, useButtonGroupIndex } from "./ButtonGroup";
export { M3GroupButton } from "./GroupButton";
export { M3SelectionGroup, M3PillTabBar } from "./SelectionGroup";
export type { M3SelectionOption } from "./SelectionGroup";

export { M3RippleButton } from "./RippleButton";
export { M3TextField } from "./TextField";
export { M3FloatPillField } from "./FloatPillField";
export {
  M3ExpressiveFieldGroup,
  M3ExpressiveFieldSegment,
} from "./ExpressiveFieldGroup";
export {
  M3ToolbarTray,
  M3TrayPillField,
  M3TrayActionPill,
} from "./ToolbarTray";
export { M3SearchField, M3_SEARCH_WIDTH_MS } from "./SearchField";
export { M3Switch } from "./Switch";
export { M3SecondaryTabBar } from "./SecondaryTabBar";
export type { M3TabItem } from "./SecondaryTabBar";
export { M3Fab } from "./Fab";
export { M3NavigationBar } from "./NavigationBar";
export type { M3NavItem, M3NavAction } from "./NavigationBar";
export { M3Pill } from "./Pill";
export { M3Chip } from "./Chip";
export type { M3ChipVariant } from "./Chip";
export { M3Breadcrumb } from "./Breadcrumb";
export type { M3BreadcrumbItem } from "./Breadcrumb";
export { M3StateLayer, M3Surface } from "./Surface";
export { M3Card } from "./Card";
export type { M3CardProps, M3CardVariant } from "./Card";
export { useRipple, RippleStyles, withRippleHostStyle } from "./useRipple";
