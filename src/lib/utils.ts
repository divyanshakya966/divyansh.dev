import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Defense-in-depth for URLs originating from admin-editable content/meta. */
export function isSafeHttpUrl(url: string): boolean {
  return /^https?:\/\/[^\s]+$/i.test(url.trim());
}

export function isSameOriginPath(url: string): boolean {
  const t = url.trim();
  return /^\/(?![/\\])/.test(t);
}

/** Returns the URL only if it is http(s) or same-origin; otherwise fallback. */
export function safeHref(url: string, fallback = ""): string {
  const t = url.trim();
  if (isSafeHttpUrl(t) || isSameOriginPath(t)) return t;
  return fallback;
}
