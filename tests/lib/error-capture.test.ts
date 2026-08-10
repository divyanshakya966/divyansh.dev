import { describe, expect, it, vi } from "vitest";
import { consumeLastCapturedError } from "@/lib/error-capture";

/**
 * error-capture module registers global listeners at import time and keeps
 * module-level state, so tests must use dynamic imports per test case.
 */

async function importFresh() {
  vi.resetModules();
  const mod = await import("@/lib/error-capture");
  return mod;
}

function fireErrorEvent(error: unknown) {
  const event = new ErrorEvent("error", { error });
  window.dispatchEvent(event);
}

function fireRejection(reason: unknown) {
  const event = new PromiseRejectionEvent("unhandledrejection", {
    promise: Promise.resolve(),
    reason,
  });
  window.dispatchEvent(event);
}

describe("error-capture", () => {
  it("returns undefined when no error has been captured", async () => {
    const { consumeLastCapturedError } = await importFresh();
    expect(consumeLastCapturedError()).toBeUndefined();
  });

  it("captures window error events and returns the error once", async () => {
    const { consumeLastCapturedError } = await importFresh();
    fireErrorEvent(new TypeError("boom"));
    expect(consumeLastCapturedError()).toBeInstanceOf(TypeError);
    expect(consumeLastCapturedError()).toBeUndefined();
  });

  it("captures unhandled promise rejections", async () => {
    const { consumeLastCapturedError } = await importFresh();
    fireRejection(new RangeError("async boom"));
    expect(consumeLastCapturedError()).toEqual(new RangeError("async boom"));
  });

  it("falls back to the event itself when error is undefined", async () => {
    const { consumeLastCapturedError } = await importFresh();
    fireErrorEvent(undefined);
    const captured = consumeLastCapturedError();
    expect(captured).toBeInstanceOf(ErrorEvent);
  });

  it("expires a captured error after the TTL (5s)", async () => {
    vi.useFakeTimers();
    try {
      const { consumeLastCapturedError } = await importFresh();
      fireErrorEvent(new Error("stale"));
      vi.advanceTimersByTime(5_001);
      expect(consumeLastCapturedError()).toBeUndefined();
    } finally {
      vi.useRealTimers();
    }
  });

  it("keeps a captured error within the TTL window", async () => {
    const { consumeLastCapturedError } = await importFresh();
    fireErrorEvent(new Error("fresh"));
    expect(consumeLastCapturedError()).toEqual(new Error("fresh"));
  });
});
