import { describe, expect, it } from "vitest";
import { cn, isSafeHttpUrl, safeHref } from "@/lib/utils";

describe("cn", () => {
  it("returns an empty string when given nothing", () => {
    expect(cn()).toBe("");
  });

  it("joins truthy class names with a space", () => {
    expect(cn("a", "b", "c")).toBe("a b c");
  });

  it("ignores falsy values", () => {
    expect(cn("a", false, null, undefined, 0, "b")).toBe("a b");
  });

  it("supports clsx-style object and array inputs", () => {
    expect(cn({ a: true, b: false }, ["c", "d"])).toBe("a c d");
  });

  it("lets tailwind-merge resolve conflicting utilities (last one wins)", () => {
    expect(cn("px-2", "px-4")).toBe("px-4");
    expect(cn("text-red-500", "text-blue-500")).toBe("text-blue-500");
  });

  it("keeps non-conflicting tailwind utilities intact", () => {
    expect(cn("p-2", "text-sm", "rounded-lg")).toBe("p-2 text-sm rounded-lg");
  });
});

describe("safe URLs", () => {
  it("accepts http(s) and same-origin paths, rejects the rest", () => {
    expect(isSafeHttpUrl("https://example.com/x")).toBe(true);
    expect(isSafeHttpUrl("http://example.com")).toBe(true);
    expect(isSafeHttpUrl("javascript:alert(1)")).toBe(false);
    expect(isSafeHttpUrl("data:text/html,x")).toBe(false);
    expect(isSafeHttpUrl("")).toBe(false);
    expect(safeHref("https://example.com", "fallback")).toBe("https://example.com");
    expect(safeHref("/local/path", "fallback")).toBe("/local/path");
    expect(safeHref("javascript:alert(1)", "fallback")).toBe("fallback");
    expect(safeHref("  ", "fallback")).toBe("fallback");
  });
});
