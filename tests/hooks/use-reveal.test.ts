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

  it("observes .reveal elements mounted after hook setup (dynamic content)", async () => {
    document.body.innerHTML = `<div id="host"></div>`;
    renderHook(() => useReveal());
    const [io] = window.__ioInstances;
    const observeSpy = vi.spyOn(io, "observe");
    const host = document.getElementById("host")!;
    await act(async () => {
      host.innerHTML = `<div class="reveal">Late</div>`;
    });
    const late = host.querySelector<HTMLElement>(".reveal")!;
    expect(observeSpy).toHaveBeenCalledWith(late);
    act(() => io.intersect(late));
    expect(late).toHaveClass("in");
  });

  it("applies stagger delays to late-mounted children", async () => {
    document.body.innerHTML = `<div id="host"><div class="reveal-stagger"></div></div>`;
    renderHook(() => useReveal());
    const stagger = document.querySelector(".reveal-stagger")!;
    await act(async () => {
      stagger.innerHTML = `<div class="reveal">A</div><div class="reveal">B</div>`;
    });
    const kids = [...stagger.querySelectorAll<HTMLElement>(".reveal")];
    expect(kids[0]?.style.transitionDelay).toBe("0ms");
    expect(kids[1]?.style.transitionDelay).toBe("80ms");
  });

  it("reveals remounted cards (seed keys swapping for database ids)", async () => {
    document.body.innerHTML = `<div id="host"><div class="reveal" data-key="seed-1">Old</div></div>`;
    renderHook(() => useReveal());
    const [io] = window.__ioInstances;
    const host = document.getElementById("host")!;
    // Simulate React remounting the card with a database id after fetch.
    await act(async () => {
      host.innerHTML = `<div class="reveal" data-key="23">New</div>`;
    });
    const next = host.querySelector<HTMLElement>(".reveal")!;
    act(() => io.intersect(next));
    expect(next).toHaveClass("in");
  });
});
