export const THEME_KEY = "ds-theme";
export type Theme = "dark";

export function applyTheme(theme: Theme) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.classList.remove("dark", "light");
  root.classList.add(theme);
}

export function getInitialTheme(): Theme {
  if (typeof window === "undefined") return "dark";
  localStorage.removeItem(THEME_KEY);
  return "dark";
}
