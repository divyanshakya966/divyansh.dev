import { describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useWindowManager } from "@/hooks/use-window-manager";

describe("useWindowManager", () => {
  it("starts closed", () => {
    const { result } = renderHook(() => useWindowManager("terminal"));
    expect(result.current.state).toBe("closed");
    expect(result.current.isOpen).toBe(false);
  });

  it("opens on the `<id>` open event", () => {
    const { result } = renderHook(() => useWindowManager("terminal"));
    act(() => window.dispatchEvent(new Event("open-terminal")));
    expect(result.current.state).toBe("restored");
    expect(result.current.isOpen).toBe(true);
  });

  it("toggles between restored and minimized via the taskbar event", () => {
    const { result } = renderHook(() => useWindowManager("terminal"));
    act(() => window.dispatchEvent(new Event("toggle-terminal")));
    expect(result.current.state).toBe("restored");
    act(() => window.dispatchEvent(new Event("toggle-terminal")));
    expect(result.current.state).toBe("minimized");
    act(() => window.dispatchEvent(new Event("toggle-terminal")));
    expect(result.current.state).toBe("restored");
  });

  it("broadcasts visibility state for the taskbar", () => {
    const onState = vi.fn();
    window.addEventListener("terminal-state", onState);
    const { result } = renderHook(() => useWindowManager("terminal"));
    act(() => result.current.open());
    window.removeEventListener("terminal-state", onState);
    const detail = onState.mock.calls.at(-1)?.[0]?.detail;
    expect(detail).toEqual({ open: true, minimized: false });
  });

  it("maximizes and restores, and resets to closed on close", () => {
    const { result } = renderHook(() => useWindowManager("command-palette"));
    act(() => result.current.open());
    act(() => result.current.maximize());
    expect(result.current.state).toBe("maximized");
    act(() => result.current.maximize());
    expect(result.current.state).toBe("restored");
    act(() => result.current.close());
    expect(result.current.state).toBe("closed");
  });

  it("tracks focus across independent windows", () => {
    const terminal = renderHook(() => useWindowManager("terminal"));
    const palette = renderHook(() => useWindowManager("command-palette"));
    act(() => terminal.result.current.open());
    expect(terminal.result.current.isFocused).toBe(true);
    expect(palette.result.current.isFocused).toBe(false);
    act(() => palette.result.current.open());
    expect(palette.result.current.isFocused).toBe(true);
    expect(terminal.result.current.isFocused).toBe(false);
    // Focusing the terminal again brings it forward without disturbing the palette.
    act(() => terminal.result.current.focus());
    expect(terminal.result.current.isFocused).toBe(true);
    expect(palette.result.current.isOpen).toBe(true);
  });

  it("keeps the page scroll-locked while any window is open", () => {
    document.body.style.overflow = "";
    const terminal = renderHook(() => useWindowManager("terminal"));
    const palette = renderHook(() => useWindowManager("command-palette"));
    act(() => terminal.result.current.open());
    act(() => palette.result.current.open());
    expect(document.body.style.overflow).toBe("hidden");
    // Closing one window must not unlock the page while the other is open.
    act(() => terminal.result.current.close());
    expect(document.body.style.overflow).toBe("hidden");
    act(() => palette.result.current.close());
    expect(document.body.style.overflow).toBe("");
  });

  it("reports when another window is open (to suppress backdrops)", () => {
    const terminal = renderHook(() => useWindowManager("terminal"));
    const palette = renderHook(() => useWindowManager("command-palette"));
    expect(terminal.result.current.otherWindowOpen).toBe(false);
    act(() => terminal.result.current.open());
    expect(terminal.result.current.otherWindowOpen).toBe(false);
    act(() => palette.result.current.open());
    // Both are now visible, so neither should dim the other.
    expect(terminal.result.current.otherWindowOpen).toBe(true);
    expect(palette.result.current.otherWindowOpen).toBe(true);
    // Minimizing the palette leaves the terminal alone again.
    act(() => palette.result.current.minimize());
    expect(terminal.result.current.otherWindowOpen).toBe(false);
  });

  it("releases the scroll lock when a window is minimized", () => {
    document.body.style.overflow = "";
    const { result } = renderHook(() => useWindowManager("terminal"));
    act(() => result.current.open());
    expect(document.body.style.overflow).toBe("hidden");
    act(() => result.current.minimize());
    expect(document.body.style.overflow).toBe("");
  });

  it("drags a window by its title bar and clamps to the viewport", () => {
    const { result } = renderHook(() => useWindowManager("terminal"));
    act(() => result.current.open());
    const start = result.current.rect;
    const makeEvent = (x: number, y: number) =>
      ({
        button: 0,
        clientX: x,
        clientY: y,
        target: document.createElement("div"),
        preventDefault: () => {},
      }) as unknown as React.PointerEvent;
    act(() => result.current.startDrag(makeEvent(100, 100)));
    act(() => {
      window.dispatchEvent(new PointerEvent("pointermove", { clientX: 160, clientY: 140 }));
      window.dispatchEvent(new PointerEvent("pointerup"));
    });
    expect(result.current.rect.x).toBe(start.x + 60);
    expect(result.current.rect.y).toBe(start.y + 40);
    // A wild drag stays on screen.
    act(() => result.current.startDrag(makeEvent(0, 0)));
    act(() => {
      window.dispatchEvent(new PointerEvent("pointermove", { clientX: -5000, clientY: -5000 }));
      window.dispatchEvent(new PointerEvent("pointerup"));
    });
    expect(result.current.rect.x).toBeGreaterThanOrEqual(0);
    expect(result.current.rect.y).toBeGreaterThan(0);
  });

  it("resizes from a corner but never below the minimum size", () => {
    const { result } = renderHook(() => useWindowManager("terminal"));
    act(() => result.current.open());
    const start = result.current.rect;
    const makeEvent = (x: number, y: number) =>
      ({
        button: 0,
        clientX: x,
        clientY: y,
        target: document.createElement("div"),
        stopPropagation: () => {},
      }) as unknown as React.PointerEvent;
    act(() => result.current.startResize("se")(makeEvent(0, 0)));
    act(() => {
      window.dispatchEvent(new PointerEvent("pointermove", { clientX: 50, clientY: 30 }));
      window.dispatchEvent(new PointerEvent("pointerup"));
    });
    expect(result.current.rect.w).toBe(start.w + 50);
    expect(result.current.rect.h).toBe(start.h + 30);
    // Collapsing past the minimum is prevented.
    act(() => result.current.startResize("se")(makeEvent(0, 0)));
    act(() => {
      window.dispatchEvent(new PointerEvent("pointermove", { clientX: -9999, clientY: -9999 }));
      window.dispatchEvent(new PointerEvent("pointerup"));
    });
    expect(result.current.rect.w).toBeGreaterThanOrEqual(320);
    expect(result.current.rect.h).toBeGreaterThanOrEqual(220);
  });
});
