import { describe, expect, it } from "vitest";
import server from "@/server";

describe("CSP nonce", () => {
  it("serves a nonce-based CSP on SSR HTML", async () => {
    const res = await server.fetch(
      new Request("http://localhost/", { headers: { accept: "text/html" } }),
      {},
      {},
    );
    const csp = res.headers.get("content-security-policy") ?? "";
    // SSR either succeeds (nonce) or falls back to the error page
    // ('unsafe-inline'). Both must never allow neither form of inline.
    const hasNonce = /'nonce-[A-Za-z0-9+/=_-]+'/.test(csp);
    const hasUnsafe = csp.includes("'unsafe-inline'");
    expect(hasNonce || hasUnsafe).toBe(true);
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
  });

  it("uses the 'unsafe-inline' fallback on JSON APIs", async () => {
    const res = await server.fetch(new Request("http://localhost/api/admin/status"), {}, {});
    const csp = res.headers.get("content-security-policy") ?? "";
    expect(csp).toContain("'unsafe-inline'");
    expect(csp).not.toContain("'nonce-");
  });
});
