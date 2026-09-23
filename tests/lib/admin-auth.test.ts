import { describe, expect, it } from "vitest";
import {
  buildSessionCookie,
  getSessionTokenFromCookie,
  hashPassword,
  isAllowedAdminOrigin,
  isOtpCode,
  newOtpCode,
  normalizeUsername,
  PBKDF2_ITERATIONS,
  timingSafeEqualHex,
  validateNewPassword,
  verifyPassword,
} from "@/lib/admin-auth";

describe("admin-auth", () => {
  it("stays within the Cloudflare Workers PBKDF2 cap (100k iterations)", () => {
    // Production workerd throws NotSupportedError above 100000, which turns
    // every login into a 401. This test fails the build before that recurs.
    expect(PBKDF2_ITERATIONS).toBeLessThanOrEqual(100_000);
  });
  it("hashes and verifies passwords with salt", async () => {
    const { hash, salt } = await hashPassword("supersecret-password-123");
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(salt).toMatch(/^[0-9a-f]{32}$/);
    expect(await verifyPassword("supersecret-password-123", salt, hash)).toBe(true);
    expect(await verifyPassword("wrong-password-12345", salt, hash)).toBe(false);
  });

  it("compares in constant time shape", () => {
    expect(timingSafeEqualHex("ab", "ab")).toBe(true);
    expect(timingSafeEqualHex("ab", "ac")).toBe(false);
    expect(timingSafeEqualHex("ab", "abc")).toBe(false);
  });

  it("normalizes usernames strictly", () => {
    expect(normalizeUsername(" Divyansh_99 ")).toBe("divyansh_99");
    expect(normalizeUsername("ab")).toBeNull();
    expect(normalizeUsername("bad name!")).toBeNull();
  });

  it("enforces a 12-char password policy", () => {
    expect(validateNewPassword("short")).toBe(false);
    expect(validateNewPassword("long-enough-password")).toBe(true);
  });

  it("parses only well-formed session cookies", () => {
    const token = "a".repeat(64);
    const req = new Request("https://example.com/", {
      headers: { cookie: `other=1; admin_session=${token}` },
    });
    expect(getSessionTokenFromCookie(req)).toBe(token);
    const bad = new Request("https://example.com/", { headers: { cookie: "admin_session=xyz" } });
    expect(getSessionTokenFromCookie(bad)).toBeNull();
  });

  it("builds httpOnly Lax cookies and checks origins", () => {
    const cookie = buildSessionCookie("a".repeat(64), true);
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=Lax");
    expect(cookie).toContain("Secure");
    const same = new Request("https://example.com/api/admin/items", {
      headers: { origin: "https://example.com" },
    });
    expect(isAllowedAdminOrigin(same)).toBe(true);
    const cross = new Request("https://example.com/api/admin/items", {
      headers: { origin: "https://evil.com" },
    });
    expect(isAllowedAdminOrigin(cross)).toBe(false);
  });

  it("generates uniform 6-digit codes", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 200; i++) {
      const code = newOtpCode();
      expect(isOtpCode(code)).toBe(true);
      seen.add(code);
    }
    // CSPRNG output must vary across samples.
    expect(seen.size).toBeGreaterThan(150);
    expect(isOtpCode("12345")).toBe(false);
    expect(isOtpCode("abcdef")).toBe(false);
  });
});
