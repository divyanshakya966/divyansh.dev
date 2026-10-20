import { describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { IntroBoot } from "@/components/portfolio/IntroBoot";
import { setMatchMedia } from "../../setup";

function pressEnter() {
  act(() => {
    fireEvent.keyDown(window, { key: "Enter" });
  });
}

describe("IntroBoot", () => {
  it("shows the GRUB-style prompt first and does not start booting", () => {
    render(<IntroBoot onCloseStart={() => {}} onDone={() => {}} />);
    expect(screen.getByText("divyansh@arch — tty1")).toBeInTheDocument();
    expect(screen.getByText(/press enter.*any key.*to boot/is)).toBeInTheDocument();
    expect(screen.getByText("divyansh.dev — secure boot")).toBeInTheDocument();
    expect(screen.getByText(/auto boot in 8s/i)).toBeInTheDocument();
    // The boot lines must not type until the user (or countdown) starts.
    expect(screen.queryByText("boot --user=divyansh")).not.toBeInTheDocument();
  });

  it("starts the sequence on Enter and boots from 0%", () => {
    render(<IntroBoot onCloseStart={() => {}} onDone={() => {}} />);
    pressEnter();
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
      pressEnter();
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

  it("fast-forwards reduced motion from 0% instead of flashing 100%", () => {
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
      pressEnter();
      // The counter starts at 0% even with reduced motion.
      expect(container.querySelector("#boot-screen")!.textContent).toContain("0%");
      // Lines appear whole (no char-by-char typing) and the counter ramps up to 100%.
      let reached = false;
      let guard = 0;
      while (guard++ < 300) {
        const el = container.querySelector("#boot-screen");
        if (!el) break;
        if (el.textContent!.includes("100%")) {
          reached = true;
          break;
        }
        act(() => vi.advanceTimersByTime(25));
      }
      expect(reached).toBe(true);
      // The reduced path closes without the 200ms hold.
      act(() => vi.advanceTimersByTime(50));
      expect(onCloseStart).toHaveBeenCalled();
      act(() => vi.advanceTimersByTime(750));
      expect(onDone).toHaveBeenCalled();
    } finally {
      setMatchMedia({});
      vi.useRealTimers();
    }
  });

  it("auto-boots after the countdown with no keypress", () => {
    vi.useFakeTimers();
    try {
      const { container } = render(<IntroBoot onCloseStart={() => {}} onDone={() => {}} />);
      // Prompt first…
      expect(container.querySelector("#boot-screen")!.textContent).toContain("secure boot");
      // Countdown ticks, then boot starts (and keeps typing without input).
      let guard = 0;
      let typed = false;
      while (guard++ < 2400) {
        act(() => vi.advanceTimersByTime(25));
        if (container.querySelector("#boot-screen")!.textContent!.includes("0%")) {
          typed = true;
          break;
        }
      }
      expect(typed).toBe(true);
      // Then the first line types — under any motion preference.
      let wrote = false;
      let guard2 = 0;
      while (guard2++ < 400) {
        const el = container.querySelector("#boot-screen");
        if (!el) break;
        if (el.textContent!.includes("boot --user")) {
          wrote = true;
          break;
        }
        act(() => vi.advanceTimersByTime(25));
      }
      expect(wrote).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it("ignores modifier combos so browser shortcuts survive the prompt", () => {
    render(<IntroBoot onCloseStart={() => {}} onDone={() => {}} />);
    act(() => {
      fireEvent.keyDown(window, { key: "r", metaKey: true });
      fireEvent.keyDown(window, { key: "c", ctrlKey: true });
      fireEvent.keyDown(window, { key: "Tab" });
      fireEvent.keyDown(window, { key: "F5" });
    });
    // Still on the prompt: the 0% counter only exists once booting begins.
    expect(document.querySelector("#boot-screen")!.textContent).not.toContain("0%");
    // A plain key still starts it.
    pressEnter();
    expect(document.querySelector("#boot-screen")!.textContent).toContain("0%");
  });

  it("unmounts cleanly without errors mid-prompt and mid-typing", () => {
    vi.useFakeTimers();
    try {
      const { unmount } = render(<IntroBoot onCloseStart={() => {}} onDone={() => {}} />);
      pressEnter();
      act(() => vi.advanceTimersByTime(200));
      unmount();
    } finally {
      vi.useRealTimers();
    }
  });
});
