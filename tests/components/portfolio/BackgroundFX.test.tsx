import { describe, expect, it, vi, afterEach } from "vitest";
import { render } from "@testing-library/react";
import { BackgroundFX } from "@/components/portfolio/BackgroundFX";
import { setMatchMedia } from "../../setup";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("BackgroundFX", () => {
  it("renders the progress bar, canvas, and overlay layers", () => {
    const { container } = render(<BackgroundFX />);
    expect(container.querySelector("canvas.matrix-rain")).not.toBeNull();
    expect(container.querySelector(".noise-overlay")).not.toBeNull();
    expect(container.querySelector(".scanlines-overlay")).not.toBeNull();
    expect(container.querySelector(".portfolio-light-vignette")).not.toBeNull();
    expect(container.querySelector('[style*="scaleX(0)"]')).not.toBeNull();
  });

  it("skips the matrix animation when reduced motion is preferred", () => {
    setMatchMedia({
      "(prefers-reduced-motion: reduce)": true,
      "(pointer: coarse)": false,
    });
    render(<BackgroundFX />);
    const canvas = document.querySelector<HTMLCanvasElement>("canvas.matrix-rain")!;
    expect(canvas.width).toBe(300);
    expect(canvas.height).toBe(150);
  });

  it("resets the canvas transform when the viewport resizes", () => {
    setMatchMedia({
      "(prefers-reduced-motion: reduce)": false,
      "(pointer: coarse)": false,
    });
    const ctx = {
      setTransform: vi.fn(),
      scale: vi.fn(),
      fillRect: vi.fn(),
      fillText: vi.fn(),
      fillStyle: "",
      font: "",
    };
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(
      ctx as unknown as CanvasRenderingContext2D,
    );
    render(<BackgroundFX />);
    expect(ctx.setTransform).toHaveBeenCalledTimes(1);
    expect(ctx.setTransform).toHaveBeenCalledWith(1, 0, 0, 1, 0, 0);
    window.dispatchEvent(new Event("resize"));
    expect(ctx.setTransform).toHaveBeenCalledTimes(2);
  });

  it("updates the scroll progress bar scaleX on scroll", () => {
    const { container } = render(<BackgroundFX />);
    Object.defineProperty(document.documentElement, "scrollHeight", {
      value: 3000,
      writable: true,
      configurable: true,
    });
    Object.defineProperty(window, "innerHeight", { value: 800, writable: true });
    Object.defineProperty(window, "scrollY", { value: 400, writable: true });

    window.dispatchEvent(new Event("scroll"));
    return new Promise<void>((resolve) => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          const bar = container.querySelector<HTMLElement>('[style*="scaleX"]')!;
          expect(bar.style.transform).toBe("scaleX(0.18181818181818182)");
          resolve();
        });
      });
    });
  });
});
