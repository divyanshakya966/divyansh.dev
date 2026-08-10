import { describe, expect, it } from "vitest";
import { site } from "@/lib/site";

describe("site config", () => {
  it("exposes a non-empty name and brand", () => {
    expect(site.name).toBe("Divyansh Shakya");
    expect(site.brand).toBe("divyansh.dev");
    expect(site.name.length).toBeGreaterThan(0);
    expect(site.brand.length).toBeGreaterThan(0);
  });

  it("has an https URL", () => {
    expect(site.url).toMatch(/^https:\/\//);
  });

  it("has a descriptive title and description", () => {
    expect(site.title.length).toBeGreaterThan(0);
    expect(site.description.length).toBeGreaterThan(0);
  });

  it("has a keyword list with no duplicates", () => {
    expect(site.keywords.length).toBeGreaterThan(0);
    expect(new Set(site.keywords).size).toBe(site.keywords.length);
  });

  it("includes the GitHub and LinkedIn profiles", () => {
    expect(site.profiles).toContain("https://github.com/divyanshakya966");
    expect(site.profiles).toContain("https://linkedin.com/in/divyanshakya966");
  });

  it("points to a local og-image asset", () => {
    expect(site.image).toMatch(/^\/og-image/);
    expect(site.imageAlt.length).toBeGreaterThan(0);
  });
});
