/**
 * Custom-pointer helpers. Kept out of the component file so `Cursor.tsx` only
 * exports a component (React Fast Refresh) and drag/resize logic can force a
 * cursor shape without importing the component.
 */
export type CursorShape = "arrow" | "ns" | "ew" | "nesw" | "nwse" | "grabbing";

/** Force the custom pointer into a shape (or release with `null`). */
export function forceCursor(shape: CursorShape | null) {
  window.dispatchEvent(new CustomEvent("cursor-force", { detail: shape }));
}

/** Read the cursor shape an element requests via its `data-cursor` attribute. */
export function shapeFromElement(t: HTMLElement | null): CursorShape | null {
  if (!t || typeof t.closest !== "function") return null;

  const cursorEl = t.closest("[data-cursor]") as HTMLElement | null;
  if (!cursorEl) return null;

  // Interactive controls (window buttons, inputs…) always win over the shape
  // requested by an ancestor — e.g. a window's draggable title bar sets
  // `data-cursor="grab"`, but hovering its Close/Minimize/Maximize buttons
  // must not keep showing the grab cursor.
  const control = t.closest(
    'button, input, textarea, select, a, [role="button"], [contenteditable]',
  ) as HTMLElement | null;
  if (control && control !== cursorEl && cursorEl.contains(control)) return null;

  const value = cursorEl.dataset.cursor;
  if (value === "ns-resize") return "ns";
  if (value === "ew-resize") return "ew";
  if (value === "nesw-resize") return "nesw";
  if (value === "nwse-resize") return "nwse";
  if (value === "grabbing" || value === "grab") return "grabbing";
  return null;
}
