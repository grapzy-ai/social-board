export type Theme = "light" | "dark" | "system";
export const THEME_COOKIE = "sb_theme";
const THEMES: readonly Theme[] = ["light", "dark", "system"];

/** Cookie → theme. Anything unknown is the default (light). */
export function resolveTheme(raw: string | undefined | null): Theme {
  return THEMES.includes(raw as Theme) ? (raw as Theme) : "light";
}

/** `data-theme` for <html>: explicit for light/dark, absent for system (media query decides). */
export function htmlThemeAttr(t: Theme): string | undefined {
  return t === "system" ? undefined : t;
}
