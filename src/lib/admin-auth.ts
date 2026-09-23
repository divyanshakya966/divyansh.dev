/**
 * Strict admin auth built for Cloudflare Workers (WebCrypto only, no Node deps).
 *
 * - Passwords: PBKDF2-SHA256, 100k iterations (Workers maximum), 16-byte
 *   salt, 32-byte hash.
 * - Sessions: 32-byte opaque token, only SHA-256(token) stored in D1.
 *   Cookie: `admin_session`, httpOnly, Secure (prod), SameSite=Lax, 12h expiry.
 * - Step-up grants: after an emailed one-time code verifies, a second
 *   short-lived grant (`admin_otp` cookie, 10 min) is required on top of the
 *   session for every mutating admin call.
 * - Login rate limiting + generic error messages (no user enumeration).
 */

export const SESSION_COOKIE = "admin_session";
export const SESSION_TTL_MS = 12 * 60 * 60 * 1000;
export const GRANT_COOKIE = "admin_otp";
export const GRANT_TTL_MS = 10 * 60 * 1000;
// Cloudflare Workers rejects PBKDF2 iteration counts above 100000
// (NotSupportedError), while Node allows more. Stay at the cap so hashes
// created anywhere verify everywhere. Do NOT raise without a runtime check.
export const PBKDF2_ITERATIONS = 100_000;
const SALT_BYTES = 16;
const HASH_BYTES = 32;
const MIN_PASSWORD_LEN = 12;

function getCrypto(): Crypto {
  const c = globalThis.crypto;
  if (!c?.subtle || !c.getRandomValues) {
    throw new Error("WebCrypto is required for admin auth");
  }
  return c;
}

export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function hexToBytes(hex: string): Uint8Array {
  if (!/^[0-9a-fA-F]+$/.test(hex) || hex.length % 2 !== 0) {
    throw new Error("Invalid hex string");
  }
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

export async function hashPassword(
  password: string,
  saltHex?: string,
): Promise<{ hash: string; salt: string }> {
  const c = getCrypto();
  const salt = saltHex ? hexToBytes(saltHex) : c.getRandomValues(new Uint8Array(SALT_BYTES));
  const key = await c.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, [
    "deriveBits",
  ]);
  const bits = await c.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: salt as BufferSource, iterations: PBKDF2_ITERATIONS },
    key,
    HASH_BYTES * 8,
  );
  return { hash: bytesToHex(new Uint8Array(bits)), salt: bytesToHex(salt) };
}

export async function verifyPassword(
  password: string,
  saltHex: string,
  expectedHashHex: string,
): Promise<boolean> {
  try {
    const { hash } = await hashPassword(password, saltHex);
    return timingSafeEqualHex(hash, expectedHashHex);
  } catch (error) {
    // Never fail open — but never fail silently either: a crypto outage
    // (e.g. unsupported params) would otherwise masquerade as wrong passwords.
    console.error("Admin password verification error:", error);
    return false;
  }
}

/** Constant-time hex comparison to avoid timing leaks. */
export function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

export function newSessionToken(): string {
  const c = getCrypto();
  return bytesToHex(c.getRandomValues(new Uint8Array(32)));
}

export async function sha256Hex(input: string): Promise<string> {
  const c = getCrypto();
  const digest = await c.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return bytesToHex(new Uint8Array(digest));
}

export function validateNewPassword(password: unknown): password is string {
  return (
    typeof password === "string" && password.length >= MIN_PASSWORD_LEN && password.length <= 256
  );
}

export const PASSWORD_POLICY_MESSAGE = `Password must be ${MIN_PASSWORD_LEN}–256 characters.`;

/** Normalize usernames: lowercase, trimmed, strict charset. */
export function normalizeUsername(username: unknown): string | null {
  if (typeof username !== "string") return null;
  const v = username.trim().toLowerCase();
  if (!/^[a-z0-9._-]{3,32}$/.test(v)) return null;
  return v;
}

export function getSessionTokenFromCookie(request: Request): string | null {
  const header = request.headers.get("cookie");
  if (!header) return null;
  for (const part of header.split(";")) {
    const idx = part.indexOf("=");
    if (idx === -1) continue;
    const name = part.slice(0, idx).trim();
    if (name === SESSION_COOKIE) {
      const value = part
        .slice(idx + 1)
        .trim()
        .replace(/^"|"$/g, "");
      if (/^[0-9a-f]{64}$/i.test(value)) return value.toLowerCase();
      return null;
    }
  }
  return null;
}

export function buildSessionCookie(token: string, secure: boolean): string {
  const maxAge = Math.floor(SESSION_TTL_MS / 1000);
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure ? "; Secure" : ""}`;
}

export function buildClearedSessionCookie(secure: boolean): string {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure ? "; Secure" : ""}`;
}

function getCookieToken(request: Request, name: string): string | null {
  const header = request.headers.get("cookie");
  if (!header) return null;
  for (const part of header.split(";")) {
    const idx = part.indexOf("=");
    if (idx === -1) continue;
    if (part.slice(0, idx).trim() !== name) continue;
    const value = part
      .slice(idx + 1)
      .trim()
      .replace(/^"|"$/g, "");
    if (/^[0-9a-f]{64}$/i.test(value)) return value.toLowerCase();
    return null;
  }
  return null;
}

export function getGrantTokenFromCookie(request: Request): string | null {
  return getCookieToken(request, GRANT_COOKIE);
}

export function buildGrantCookie(token: string, secure: boolean): string {
  const maxAge = Math.floor(GRANT_TTL_MS / 1000);
  return `${GRANT_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure ? "; Secure" : ""}`;
}

export function buildClearedGrantCookie(secure: boolean): string {
  return `${GRANT_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure ? "; Secure" : ""}`;
}

/** 6-digit numeric code from a CSPRNG (leading zeros preserved). */
export function newOtpCode(): string {
  const bytes = getCrypto().getRandomValues(new Uint8Array(4));
  const n = ((bytes[0]! << 24) | (bytes[1]! << 16) | (bytes[2]! << 8) | bytes[3]!) >>> 0;
  return String(n % 1_000_000).padStart(6, "0");
}

export function isOtpCode(value: unknown): value is string {
  return typeof value === "string" && /^[0-9]{6}$/.test(value);
}

export function isSecureRequest(request: Request): boolean {
  try {
    return new URL(request.url).protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * Same-origin check for cookie-authenticated POSTs (CSRF defence in depth
 * on top of SameSite=Lax). Allows requests with no Origin/Referer (curl,
 * same-origin fetch) but rejects cross-origin values.
 */
export function isAllowedAdminOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  const referer = request.headers.get("referer");
  if (!origin && !referer) return true;
  try {
    const host = new URL(request.url).host;
    if (origin && new URL(origin).host === host) return true;
    if (referer && new URL(referer).host === host) return true;
    return false;
  } catch {
    return false;
  }
}
