import { describe, expect, it } from "vitest";
import {
  SEED_CERTIFICATIONS,
  isContentKind,
  rowToContentItem,
  sortContent,
  validateContentInput,
} from "@/lib/content";

describe("content model", () => {
  it("seeds the two real certifications with verify URLs", () => {
    expect(SEED_CERTIFICATIONS).toHaveLength(2);
    const urls = SEED_CERTIFICATIONS.map((c) => c.url);
    expect(urls[0]).toContain("assets.tryhackme.com");
    expect(urls[1]).toContain("ti-user-certificates.s3");
    expect(SEED_CERTIFICATIONS[0]?.tags).toContain("Web App Security");
    expect(SEED_CERTIFICATIONS[1]?.tags).toContain("Kubernetes");
  });

  it("validates kinds", () => {
    expect(isContentKind("certification")).toBe(true);
    expect(isContentKind("research")).toBe(true);
    expect(isContentKind("blog")).toBe(true);
    expect(isContentKind("project")).toBe(false);
    expect(isContentKind(undefined)).toBe(false);
  });

  it("accepts a valid input and cleans tags/urls", () => {
    const res = validateContentInput({
      kind: "blog",
      title: "  Hello  ",
      subtitle: "Notes",
      description: "Body",
      url: "https://example.com/post",
      tags: "a, b, a ",
      sort_order: 3,
      is_visible: true,
    });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.value.title).toBe("Hello");
      expect(res.value.tags).toEqual(["a", "b", "a"]);
      expect(res.value.sort_order).toBe(3);
    }
  });

  it("rejects bad kind, empty title and bad sort_order", () => {
    expect(validateContentInput({ kind: "x", title: "t" }).ok).toBe(false);
    expect(validateContentInput({ kind: "blog", title: "  " }).ok).toBe(false);
    expect(validateContentInput({ kind: "blog", title: "t", sort_order: "NaN" }).ok).toBe(false);
  });

  it("maps D1 rows to items", () => {
    const item = rowToContentItem({
      id: 7,
      kind: "research",
      title: "P",
      subtitle: "V",
      description: "D",
      url: "https://x",
      image: "",
      tags: '["a","b"]',
      sort_order: 2,
      is_visible: 1,
      created_at: 1,
      updated_at: 2,
    });
    expect(item.tags).toEqual(["a", "b"]);
    expect(item.is_visible).toBe(true);
  });

  it("sorts by sort_order", () => {
    const sorted = sortContent([
      { ...SEED_CERTIFICATIONS[1]!, sort_order: 5 },
      { ...SEED_CERTIFICATIONS[0]!, sort_order: 1 },
    ]);
    expect(sorted[0]?.title).toContain("SEC1");
  });
});
