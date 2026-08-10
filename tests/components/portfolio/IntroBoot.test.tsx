import { describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import { IntroBoot } from "@/components/portfolio/IntroBoot";

describe("IntroBoot", () => {
  it("renders the boot screen with a header and loader", () => {
    render(<IntroBoot onCloseStart={() => {}} onDone={() => {}} />);
    expect(screen.getByText("divyansh@arch — tty1")).toBeInTheDocument();
    expect(screen.getByText("secure boot")).toBeInTheDocument();
    expect(screen.getByText("0%")).toBeInTheDocument();
  });

  it("types lines one by one and reaches 100%", () => {
    vi.useFakeTimers();
    try {
      const onCloseStart = vi.fn();
      const onDone = vi.fn();
      const { container } = render(<IntroBoot onCloseStart={onCloseStart} onDone={onDone} />);
      const bootScreen = container.querySelector("#boot-screen")!;

      for (let i = 0; i < 60; i++) {
        act(() => vi.advanceTimersByTime(25));
      }
      expect(bootScreen.textContent).toContain("boot --user=divyansh");

      const seen = { pct: false };
      let guard = 0;
      while (document.querySelector("#boot-screen") && guard++ < 1500) {
        act(() => vi.advanceTimersByTime(25));
        if (bootScreen.textContent!.includes("100%") && !seen.pct) seen.pct = true;
      }
      expect(seen.pct).toBe(true);
      expect(onCloseStart).toHaveBeenCalled();
      expect(onDone).toHaveBeenCalled();
      expect(document.querySelector("#boot-screen")).not.toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it("skips typing when reduced motion is enabled", () => {
    vi.useFakeTimers();
    try {
      Object.defineProperty(window, "matchMedia", {
        writable: true,
        value: (query: string) => ({
          matches: query.includes("prefers-reduced-motion: reduce"),
          addEventListener: () => {},
          removeEventListener: () => {},
          addListener: () => {},
          removeListener: () => {},
        }),
      });
      const onCloseStart = vi.fn();
      const onDone = vi.fn();
      const { container } = render(<IntroBoot onCloseStart={onCloseStart} onDone={onDone} />);
      act(() => vi.advanceTimersByTime(0));
      expect(container.querySelector("#boot-screen")!.textContent).toContain("100%");
    } finally {
      vi.useRealTimers();
    }
  });

  it("unmounts cleanly without errors mid-typing", () => {
    vi.useFakeTimers();
    try {
      const { unmount } = render(<IntroBoot onCloseStart={() => {}} onDone={() => {}} />);
      act(() => vi.advanceTimersByTime(200));
      unmount();
    } finally {
      vi.useRealTimers();
    }
  });
});
