import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, vi } from "vitest";
import { cleanup } from "@testing-library/react";

afterEach(() => {
  cleanup();
});

/**
 * Minimal IntersectionObserver mock.
 * Every constructed observer instance is pushed onto `window.__ioInstances`
 * so tests can trigger intersections manually (see tests/hooks/use-reveal.test.ts).
 */
class MockIntersectionObserver implements IntersectionObserver {
  readonly root = null;
  readonly rootMargin = "";
  readonly thresholds = [0];
  private readonly targets = new Set<Element>();

  constructor(
    private readonly callback: IntersectionObserverCallback,
    _options?: IntersectionObserverInit,
  ) {
    window.__ioInstances.push(this);
  }

  observe(target: Element) {
    this.targets.add(target);
  }

  unobserve(target: Element) {
    this.targets.delete(target);
  }

  disconnect() {
    this.targets.clear();
  }

  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }

  /** Test helper: report `target` as intersecting and fire the callback. */
  intersect(target: Element) {
    if (!this.targets.has(target)) return;
    const entry = {
      target,
      isIntersecting: true,
      intersectionRatio: 1,
      boundingClientRect: target.getBoundingClientRect(),
      intersectionRect: target.getBoundingClientRect(),
      rootBounds: null,
      time: performance.now(),
    } as IntersectionObserverEntry;
    this.callback([entry], this);
  }
}

declare global {
  interface Window {
    __ioInstances: MockIntersectionObserver[];
  }
}

beforeEach(() => {
  window.__ioInstances = [];
  vi.stubGlobal("IntersectionObserver", MockIntersectionObserver);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

/**
 * matchMedia stub — controllable per test via `setMatchMedia`.
 * Default: reduced-motion off, fine pointer, light scheme.
 */
const matchMediaImpl = (query: string): MediaQueryList =>
  ({
    matches: !String(query).includes("prefers-reduced-motion: reduce"),
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }) as unknown as MediaQueryList;

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: matchMediaImpl,
});

/** Override matchMedia results in a test, e.g. setMatchMedia({ matches: { "…": true } }). */
export function setMatchMedia(overrides: Record<string, boolean>) {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: (query: string): MediaQueryList => {
      const base = matchMediaImpl(query);
      Object.defineProperty(base, "matches", {
        value: overrides[query] ?? base.matches,
        writable: false,
      });
      return base;
    },
  });
}

/** Minimal ResizeObserver stub (used by Radix primitives). */
if (typeof window.ResizeObserver === "undefined") {
  class MockResizeObserver implements ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  Object.defineProperty(window, "ResizeObserver", {
    writable: true,
    value: MockResizeObserver,
  });
}
