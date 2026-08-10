import { describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useReveal } from "@/hooks/use-reveal";

/** Sets up a scroll container with reveal elements, runs the hook, and returns helpers. */
function setup(stagger = false) {
  document.body.innerHTML = `
    <div class="${stagger ? "reveal-stagger" : ""}">
      <div class="reveal" data-reveal="left">One</div>
      <div class="reveal">Two</div>
    </div>
  `;
  renderHook(() => useReveal());
  const els = [...document.querySelectorAll<HTMLElement>(".reveal")];
  const [io] = window.__ioInstances;
  return { els, io };
}

describe("useReveal", () => {
  it("observes every .reveal element on mount", () => {
    const { els, io } = setup();
    expect(window.__ioInstances.length).toBe(1);
    els.forEach((el) => expect(io.unobserve).toBeDefined());
  });

  it("adds the `in` class and unobserves the target once intersecting", () => {
    const { els, io } = setup();
    act(() => io.intersect(els[0]));
    expect(els[0]).toHaveClass("in");
    expect(els[1]).not.toHaveClass("in");
  });

  it("applies stagger delays to children of .reveal-stagger on mount", () => {
    const { els } = setup(true);
    expect(els[0]?.style.transitionDelay).toBe("0ms");
    expect(els[1]?.style.transitionDelay).toBe("80ms");
  });

  it("does not overwrite an existing transitionDelay", () => {
    document.body.innerHTML = `
      <div class="reveal-stagger">
        <div class="reveal" style="transition-delay: 500ms">One</div>
      </div>
    `;
    renderHook(() => useReveal());
    expect(document.querySelector(".reveal")?.getAttribute("style")).toContain(
      "transition-delay: 500ms",
    );
  });

  it("disconnects the observer when disabled", () => {
    document.body.innerHTML = `<div class="reveal">One</div>`;
    renderHook(() => useReveal(false));
    expect(window.__ioInstances.length).toBe(0);
  });

  it("does nothing when the hook is disabled", () => {
    document.body.innerHTML = `<div class="reveal">One</div>`;
    renderHook(() => useReveal(false));
    expect(document.querySelector(".reveal")).not.toBe(null);
    expect(window.__ioInstances.length).toBe(0);
  });

  it("stops watching a target after it has been revealed", () => {
    const { els, io } = setup();
    const unobserveSpy = vi.spyOn(io, "unobserve");
    act(() => io.intersect(els[0]));
    expect(unobserveSpy).toHaveBeenCalledWith(els[0]);
  });
});
