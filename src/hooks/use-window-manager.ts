import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { forceCursor } from "@/lib/cursor";

/**
 * A tiny OS-style window state machine shared by the portfolio's floating
 * shells (terminal, command palette). The navbar acts as the taskbar: it
 * listens for `<id>-state` events and dispatches `<id>-toggle` to minimize /
 * restore the window, mirroring how a desktop taskbar button behaves.
 *
 *   closed ──open──▶ restored ⇄ maximized
 *                      │  ▲
 *             minimize │  │ restore (taskbar click)
 *                      ▼  │
 *                   minimized
 *
 *   any ──close──▶ closed
 *
 * Windows are independent — opening one never closes the other. A module-level
 * focus bus tracks which window is on top so only the focused window dims the
 * page and grabs dismiss clicks, letting both run side by side. Each window
 * also carries its own free-floating rect so it can be dragged and resized
 * like a real desktop window.
 */
export type WindowId = "terminal" | "command-palette";

export type WindowState = "closed" | "restored" | "minimized" | "maximized";

export type Rect = { x: number; y: number; w: number; h: number };

export type ResizeEdge = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";

/** Cursor shape to force while dragging a given edge/corner. */
export const EDGE_CURSOR: Record<ResizeEdge, "ns" | "ew" | "nesw" | "nwse"> = {
  n: "ns",
  s: "ns",
  e: "ew",
  w: "ew",
  ne: "nesw",
  nw: "nwse",
  se: "nwse",
  sw: "nesw",
};

/** Navbar height + a small breathing gap; windows/taskbar live below this. */
export const NAV_OFFSET = 72;

const MIN_W = 320;
const MIN_H = 220;

// --- Focus bus: which window is currently on top. ---
let focusedWindow: WindowId | null = null;
const focusListeners = new Set<() => void>();

function setFocusedWindow(id: WindowId | null) {
  if (focusedWindow === id) return;
  focusedWindow = id;
  focusListeners.forEach((l) => l());
}

function subscribeFocus(listener: () => void) {
  focusListeners.add(listener);
  return () => {
    focusListeners.delete(listener);
  };
}

function useFocused(id: WindowId): boolean {
  return useSyncExternalStore(
    subscribeFocus,
    () => focusedWindow === id,
    () => false,
  );
}

// --- Visibility registry: which windows are currently on screen. ---
const visibleWindows = new Set<WindowId>();

/**
 * True when at least one *other* window is also visible. Used to skip a
 * window's full-screen dim/backdrop so two windows can sit side by side
 * without one blurring the other.
 */
function useOtherWindowOpen(id: WindowId): boolean {
  return useSyncExternalStore(
    subscribeFocus,
    () => {
      for (const w of visibleWindows) if (w !== id) return true;
      return false;
    },
    () => false,
  );
}

// --- Shared body-scroll lock (ref-counted across windows + other overlays). ---
const scrollLock = new Set<string>();

function syncScrollLock() {
  document.body.style.overflow = scrollLock.size > 0 ? "hidden" : "";
}

/** Register/clear a named scroll lock; the page unlocks when none remain. */
export function lockBodyScroll(key: string, locked: boolean) {
  if (locked) scrollLock.add(key);
  else scrollLock.delete(key);
  syncScrollLock();
}

function lockScroll(id: WindowId, locked: boolean) {
  lockBodyScroll(id, locked);
}

/** True while at least one shell window is visible (site should stay dimmed). */
export function useAnyWindowVisible(): boolean {
  return useSyncExternalStore(
    subscribeFocus,
    () => visibleWindows.size > 0,
    () => false,
  );
}

/**
 * Click-away for the shared scrim: close whichever window is currently
 * focused, if any. Windows are never blurred by the scrim — it renders
 * *below* every window, so the site stays dimmed while siblings stay crisp.
 */
export function dismissFocusedWindow() {
  const id = focusedWindow;
  if (!id) return;
  window.dispatchEvent(new Event(`close-${id}`));
}

function viewport() {
  return {
    w: typeof window === "undefined" ? 1280 : window.innerWidth,
    h: typeof window === "undefined" ? 800 : window.innerHeight,
  };
}

/** Default stacked placement, scaled to the viewport on first open. */
function defaultRect(id: WindowId): Rect {
  const { w, h } = viewport();
  const width = Math.min(id === "terminal" ? 640 : 560, Math.max(MIN_W, w - 48));
  const height = Math.min(id === "terminal" ? 460 : 420, Math.max(MIN_H, h - NAV_OFFSET - 48));
  const cascade = id === "terminal" ? 0 : 36;
  const x = Math.max(12, Math.round((w - width) / 2) + cascade);
  const y = Math.max(NAV_OFFSET + 12, Math.round(h * 0.14) + cascade);
  return { x, y, w: width, h: height };
}

function clampRect(rect: Rect): Rect {
  const { w, h } = viewport();
  const width = Math.min(Math.max(rect.w, MIN_W), w - 16);
  const height = Math.min(Math.max(rect.h, MIN_H), h - NAV_OFFSET - 8);
  const x = Math.min(Math.max(rect.x, 8), w - width - 8);
  const y = Math.min(Math.max(rect.y, NAV_OFFSET + 4), h - 64);
  return { x, y, w: width, h: height };
}

export function useWindowManager(id: WindowId) {
  const [state, setState] = useState<WindowState>("closed");
  const [rect, setRectState] = useState<Rect>(() => defaultRect(id));
  const focused = useFocused(id);
  const otherWindowOpen = useOtherWindowOpen(id);

  // Mirrors `state` so event-driven callbacks (taskbar toggle) read the
  // current value without impure side effects inside setState updaters.
  // Synced in an effect — refs must not be written during render.
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const setRect = useCallback((next: Rect | ((r: Rect) => Rect)) => {
    setRectState((r) => clampRect(typeof next === "function" ? next(r) : next));
  }, []);

  const open = useCallback(() => {
    setState("restored");
    setFocusedWindow(id);
  }, [id]);

  /** Taskbar / hotkey toggle: restore if hidden, minimize if showing. */
  const toggle = useCallback(() => {
    // Focus is mutated *before* the state update (never inside an updater —
    // updaters must stay pure) so `restored` and `isFocused` land in the same
    // render and the dim/blur backdrop never flashes unblurred.
    if (stateRef.current === "closed" || stateRef.current === "minimized") {
      setFocusedWindow(id);
      setState("restored");
    } else {
      setFocusedWindow(null);
      setState("minimized");
    }
  }, [id]);

  const focus = useCallback(() => setFocusedWindow(id), [id]);

  const minimize = useCallback(() => {
    setState("minimized");
    // Promote the remaining visible sibling (desktop taskbar behavior); when
    // none, clear focus so nothing appears dimmed/backdrop-dismissable.
    const other = [...visibleWindows].find((w) => w !== id);
    setFocusedWindow(other ?? null);
  }, [id]);

  const maximize = useCallback(() => {
    setFocusedWindow(id);
    setState((s) => (s === "maximized" ? "restored" : "maximized"));
  }, [id]);

  const close = useCallback(() => {
    setState("closed");
    const other = [...visibleWindows].find((w) => w !== id);
    setFocusedWindow(other ?? null);
  }, [id]);

  /** Begin dragging the window by its title bar. */
  const startDrag = useCallback(
    (e: React.PointerEvent) => {
      if (state === "maximized") return;
      if (e.button !== 0) return;
      // Ignore drags that start on an interactive control (window buttons…).
      if ((e.target as HTMLElement).closest("button, input, a, select, textarea")) return;
      e.preventDefault();
      const origin = { x: e.clientX, y: e.clientY };
      const base = { ...rect };
      setFocusedWindow(id);
      forceCursor("grabbing");
      const onMove = (ev: PointerEvent) => {
        setRect({ ...base, x: base.x + ev.clientX - origin.x, y: base.y + ev.clientY - origin.y });
      };
      const onUp = () => {
        forceCursor(null);
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
      };
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    },
    [id, state, rect, setRect],
  );

  /** Begin resizing from a given edge/corner. */
  const startResize = useCallback(
    (edge: ResizeEdge) => (e: React.PointerEvent) => {
      if (state === "maximized") return;
      if (e.button !== 0) return;
      e.stopPropagation();
      setFocusedWindow(id);
      forceCursor(EDGE_CURSOR[edge]);
      const origin = { x: e.clientX, y: e.clientY };
      const base = { ...rect };
      const onMove = (ev: PointerEvent) => {
        const dx = ev.clientX - origin.x;
        const dy = ev.clientY - origin.y;
        let { x, y, w, h } = base;
        if (edge.includes("e")) w = base.w + dx;
        if (edge.includes("s")) h = base.h + dy;
        if (edge.includes("w")) {
          w = base.w - dx;
          x = base.x + dx;
        }
        if (edge.includes("n")) {
          h = base.h - dy;
          y = base.y + dy;
        }
        w = Math.max(MIN_W, w);
        h = Math.max(MIN_H, h);
        if (edge.includes("w") && w !== MIN_W) x = base.x + (base.w - w);
        if (edge.includes("n") && h !== MIN_H) y = base.y + (base.h - h);
        setRect(clampRect({ x, y, w, h }));
      };
      const onUp = () => {
        forceCursor(null);
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
      };
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    },
    [id, state, rect, setRect],
  );

  useEffect(() => {
    const onOpen = () => {
      setState("restored");
      setFocusedWindow(id);
    };
    const onToggle = () => toggle();
    const onClose = () => close();
    window.addEventListener(`open-${id}`, onOpen);
    window.addEventListener(`toggle-${id}`, onToggle);
    window.addEventListener(`close-${id}`, onClose);
    return () => {
      window.removeEventListener(`open-${id}`, onOpen);
      window.removeEventListener(`toggle-${id}`, onToggle);
      window.removeEventListener(`close-${id}`, onClose);
    };
  }, [id, toggle, close]);

  // Keep a restored window inside the viewport when the browser resizes.
  useEffect(() => {
    const onResize = () => setRect((r) => r);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [setRect]);

  // Broadcast visibility so the navbar taskbar can reflect the window.
  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent(`${id}-state`, {
        detail: { open: state !== "closed", minimized: state === "minimized" },
      }),
    );
  }, [id, state]);

  // Ref-counted scroll lock: the page stays locked while any visible window
  // is open, regardless of which one closes first. Minimized windows release
  // their hold so the page can scroll again.
  useEffect(() => {
    const locked = state === "restored" || state === "maximized";
    lockScroll(id, locked);
    return () => lockScroll(id, false);
  }, [id, state]);

  // Track this window in the shared visibility registry so siblings know
  // whether another window is on screen (to suppress per-window backdrops).
  useEffect(() => {
    const visible = state === "restored" || state === "maximized";
    const had = visibleWindows.has(id);
    if (visible) visibleWindows.add(id);
    else visibleWindows.delete(id);
    if (had !== visible) focusListeners.forEach((l) => l());
    return () => {
      visibleWindows.delete(id);
      focusListeners.forEach((l) => l());
    };
  }, [id, state]);

  return {
    state,
    isOpen: state !== "closed",
    isMinimized: state === "minimized",
    isMaximized: state === "maximized",
    isFocused: focused,
    otherWindowOpen,
    rect,
    setRect,
    startDrag,
    startResize,
    focus,
    open,
    toggle,
    minimize,
    maximize,
    close,
  };
}
