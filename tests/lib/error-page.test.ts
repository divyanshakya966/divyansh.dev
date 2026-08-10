import { describe, expect, it } from "vitest";
import { renderErrorPage } from "@/lib/error-page";

describe("renderErrorPage", () => {
  it("returns a complete HTML document", () => {
    const html = renderErrorPage();
    expect(html).toMatch(/^<!doctype html>/);
    expect(html).toContain("<html");
    expect(html).toContain("</html>");
  });

  it("has a proper title and lang attribute", () => {
    const html = renderErrorPage();
    expect(html).toContain('<html lang="en">');
    expect(html).toContain("<title>This page didn't load</title>");
  });

  it("includes the favicon links", () => {
    const html = renderErrorPage();
    expect(html).toContain('href="/favicon.ico?v=2"');
  });

  it("offers a reload button that calls location.reload()", () => {
    const html = renderErrorPage();
    expect(html).toContain('onclick="location.reload()"');
    expect(html).toContain("Try again");
  });

  it("links back home", () => {
    const html = renderErrorPage();
    expect(html).toContain('<a class="secondary" href="/">Go home</a>');
  });

  it("contains a viewport meta tag for mobile", () => {
    const html = renderErrorPage();
    expect(html).toContain('name="viewport"');
  });
});
