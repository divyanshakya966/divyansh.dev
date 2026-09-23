import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";
import { site } from "./lib/site";
import {
  CONTENT_KINDS,
  SEEDS,
  isContentKind,
  rowToContentItem,
  sortContent,
  validateContentInput,
  type ContentItem,
  type ContentKind,
} from "./lib/content";
import {
  DEFAULT_SETTINGS,
  isSettingKey,
  mergeSettings,
  validateSettingValue,
} from "./lib/settings";
import {
  GRANT_TTL_MS,
  SESSION_TTL_MS,
  buildClearedGrantCookie,
  buildClearedSessionCookie,
  buildGrantCookie,
  buildSessionCookie,
  getGrantTokenFromCookie,
  getSessionTokenFromCookie,
  hashPassword,
  isAllowedAdminOrigin,
  isOtpCode,
  isSecureRequest,
  newOtpCode,
  newSessionToken,
  normalizeUsername,
  sha256Hex,
  timingSafeEqualHex,
  validateNewPassword,
  verifyPassword,
  PASSWORD_POLICY_MESSAGE,
} from "./lib/admin-auth";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

type ContactPayload = {
  name: string;
  email: string;
  message: string;
  company?: string;
};

/** Minimal D1 typings so we don't need @cloudflare/workers-types. */
type D1Result<T = Record<string, unknown>> = {
  results: T[];
  success: boolean;
};
type D1Statement = {
  bind: (...values: unknown[]) => D1Statement;
  first: <T = Record<string, unknown>>() => Promise<T | null>;
  all: <T = Record<string, unknown>>() => Promise<D1Result<T>>;
  run: () => Promise<{ success: boolean; meta?: { last_row_id?: number } }>;
};
type D1Database = {
  prepare: (query: string) => D1Statement;
  batch?: (statements: D1Statement[]) => Promise<unknown[]>;
};

type WorkerEnv = {
  DB?: D1Database;
  RESEND_API_KEY?: string;
  RESEND_FROM_EMAIL?: string;
  CONTACT_TO_EMAIL?: string;
  CONTACT_RATE_LIMIT_MAX?: string;
  CONTACT_RATE_LIMIT_WINDOW_MS?: string;
  ADMIN_USERNAME?: string;
  ADMIN_PASSWORD_HASH?: string;
  ADMIN_PASSWORD_SALT?: string;
  ADMIN_EMAIL?: string;
};

const CONTACT_API_PATH = "/api/contact";
const CONTENT_API_PATH = "/api/content";
const SETTINGS_API_PATH = "/api/settings";
const ADMIN_API_PREFIX = "/api/admin/";
const ROBOTS_PATH = "/robots.txt";
const SITEMAP_PATH = "/sitemap.xml";
const DEFAULT_TO_EMAIL = "divyanshakya.dev@gmail.com";
const DEFAULT_FROM_EMAIL = "onboarding@resend.dev";
const DEFAULT_RATE_LIMIT_MAX = 5;
const DEFAULT_RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const LOGIN_RATE_LIMIT_MAX = 5;
const LOGIN_RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
// Step-up (OTP) policy: emailed 6-digit codes, short-lived and attempt-capped;
// a verified grant then unlocks mutations for GRANT_TTL_MS.
const OTP_TTL_MS = 10 * 60 * 1000;
const OTP_MAX_ATTEMPTS = 5;
const OTP_MAX_SEND_PER_HOUR = 5;
const OTP_MIN_RESEND_MS = 60 * 1000;
const OTP_VERIFY_IP_MAX = 10;
const OTP_VERIFY_IP_WINDOW_MS = 10 * 60 * 1000;
const OTP_REQUIRED_ERROR = "Step-up verification required. Verify the emailed code first.";
// DoS guard: every JSON endpoint shares this cap (largest legit payload is a
// few KB — description 4000 + meta 4000 + tags). Oversized bodies are
// rejected before JSON.parse ever runs.
const MAX_JSON_BYTES = 64 * 1024;
const GENERIC_AUTH_ERROR = "Invalid username or password.";
// Fixed dummy PBKDF2 operands: burned on every unknown-user login so valid
// and invalid usernames take the same time (timing-oracle defence).
const DUMMY_SALT_HEX = "00".repeat(16);
const DUMMY_HASH_HEX = "00".repeat(32);

let serverEntryPromise: Promise<ServerEntry> | undefined;
const contactRateLimitStore = new Map<string, number[]>();
const loginRateLimitStore = new Map<string, number[]>();
const otpVerifyRateLimitStore = new Map<string, number[]>();

/* In-memory fallbacks for local dev before D1 is bound. Not for production. */
type FallbackSession = { username: string; userId: number; expiresAt: number };
const fallbackSessions = new Map<string, FallbackSession>();
type FallbackRow = Record<string, unknown>;
const fallbackContent = new Map<number, FallbackRow>();
const fallbackSettings: Record<string, string> = {};
let fallbackContentSeq = 1000;
let fallbackSeeded = false;

function seedFallbackContent() {
  if (fallbackSeeded) return;
  fallbackSeeded = true;
  const now = Date.now();
  for (const kind of CONTENT_KINDS) {
    for (const seed of SEEDS[kind]) {
      const id = fallbackContentSeq++;
      fallbackContent.set(id, {
        id,
        kind: seed.kind,
        title: seed.title,
        subtitle: seed.subtitle,
        description: seed.description,
        url: seed.url,
        image: seed.image,
        tags: JSON.stringify(seed.tags),
        meta: JSON.stringify(seed.meta ?? {}),
        sort_order: seed.sort_order,
        is_visible: 1,
        created_at: now,
        updated_at: now,
      });
    }
  }
}

function securityHeaders(): HeadersInit {
  return {
    // Clickjacking defence for /admin (no legitimate framing anywhere).
    "content-security-policy": "frame-ancestors 'self'",
    "x-frame-options": "SAMEORIGIN",
    "x-content-type-options": "nosniff",
    "referrer-policy": "same-origin",
  };
}

function withSecurityHeaders(response: Response): Response {
  const headers = new Headers(response.headers);
  for (const [k, v] of Object.entries(securityHeaders())) headers.set(k, v);
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function jsonResponse(payload: unknown, status = 200, extraHeaders?: HeadersInit): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...securityHeaders(),
      ...(extraHeaders ?? {}),
    },
  });
}

function sitemapResponse(): Response {
  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${site.url}/</loc>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>
</urlset>
`;

  return new Response(body, {
    headers: {
      "content-type": "application/xml; charset=utf-8",
      "cache-control": "public, max-age=0, must-revalidate",
      ...securityHeaders(),
    },
  });
}

function robotsResponse(): Response {
  const body = `User-agent: *
Allow: /
Disallow: /admin
Disallow: /api/admin/

Sitemap: ${site.url}/sitemap.xml
`;

  return new Response(body, {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "public, max-age=0, must-revalidate",
      ...securityHeaders(),
    },
  });
}

function getWorkerEnv(env: unknown): WorkerEnv {
  if (env && typeof env === "object") {
    return env as WorkerEnv;
  }
  return {};
}

function getEnvValue(workerEnv: WorkerEnv, key: keyof WorkerEnv): string | undefined {
  const fromWorker = workerEnv[key];
  if (typeof fromWorker === "string" && (fromWorker as string).trim()) {
    return (fromWorker as string).trim();
  }

  if (typeof process !== "undefined") {
    const fromProcess = (process.env as Record<string, string | undefined>)[key as string];
    if (typeof fromProcess === "string" && fromProcess.trim()) {
      return fromProcess.trim();
    }
  }

  return undefined;
}

function getDb(env: unknown): D1Database | null {
  const workerEnv = getWorkerEnv(env);
  const db = workerEnv.DB;
  if (db && typeof (db as D1Database).prepare === "function") return db;
  return null;
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function getNumberEnvValue(
  workerEnv: WorkerEnv,
  key: "CONTACT_RATE_LIMIT_MAX" | "CONTACT_RATE_LIMIT_WINDOW_MS",
  fallback: number,
): number {
  const value = getEnvValue(workerEnv, key);
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function getClientIp(request: Request): string {
  const cfIp = request.headers.get("cf-connecting-ip")?.trim();
  if (cfIp) return cfIp;

  const forwardedFor = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  if (forwardedFor) return forwardedFor;

  return "unknown";
}

function hitRateLimit(
  store: Map<string, number[]>,
  key: string,
  windowMs: number,
  max: number,
): boolean {
  const now = Date.now();
  if (store.size > 10_000) {
    const cutoff = now - windowMs;
    for (const [k, timestamps] of store) {
      const latest = timestamps[timestamps.length - 1];
      if (latest === undefined || latest < cutoff) store.delete(k);
    }
  }
  const existing = store.get(key) ?? [];
  const recent = existing.filter((t) => now - t < windowMs);
  if (recent.length >= max) {
    store.set(key, recent);
    return true;
  }
  recent.push(now);
  store.set(key, recent);
  return false;
}

function isRateLimited(request: Request, workerEnv: WorkerEnv): boolean {
  const ip = getClientIp(request);
  const windowMs = getNumberEnvValue(
    workerEnv,
    "CONTACT_RATE_LIMIT_WINDOW_MS",
    DEFAULT_RATE_LIMIT_WINDOW_MS,
  );
  const maxRequests = getNumberEnvValue(
    workerEnv,
    "CONTACT_RATE_LIMIT_MAX",
    DEFAULT_RATE_LIMIT_MAX,
  );
  return hitRateLimit(contactRateLimitStore, `contact:${ip}`, windowMs, maxRequests);
}

function isLoginRateLimited(request: Request): boolean {
  return hitRateLimit(
    loginRateLimitStore,
    `login:${getClientIp(request)}`,
    LOGIN_RATE_LIMIT_WINDOW_MS,
    LOGIN_RATE_LIMIT_MAX,
  );
}

const MAX_NAME_LENGTH = 120;
const MAX_EMAIL_LENGTH = 254;
const MAX_MESSAGE_LENGTH = 5000;

function parseContactPayload(payload: unknown): ContactPayload | null {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return null;
  }

  const data = payload as Record<string, unknown>;
  const name = typeof data.name === "string" ? data.name.trim() : "";
  const email = typeof data.email === "string" ? data.email.trim() : "";
  const message = typeof data.message === "string" ? data.message.trim() : "";

  if (
    !name ||
    !email ||
    !message ||
    name.length > MAX_NAME_LENGTH ||
    email.length > MAX_EMAIL_LENGTH ||
    message.length > MAX_MESSAGE_LENGTH ||
    !isValidEmail(email)
  ) {
    return null;
  }

  return { name, email, message };
}

async function handleContactRequest(request: Request, env: unknown): Promise<Response> {
  if (request.method !== "POST") {
    return new Response("Method not allowed", {
      status: 405,
      headers: { allow: "POST", ...securityHeaders() },
    });
  }

  const body = await readJson(request);
  if (body === undefined) {
    return jsonResponse({ error: "Invalid JSON body" }, 400);
  }

  const payload = parseContactPayload(body);
  if (!payload) {
    return jsonResponse({ error: "Invalid contact payload" }, 400);
  }

  if ((body as Record<string, unknown>).company) {
    return jsonResponse({ ok: true });
  }

  const workerEnv = getWorkerEnv(env);
  if (isRateLimited(request, workerEnv)) {
    return jsonResponse({ error: "Too many requests. Please try again later." }, 429);
  }

  const resendApiKey = getEnvValue(workerEnv, "RESEND_API_KEY");
  if (!resendApiKey) {
    console.error("Missing RESEND_API_KEY");
    return jsonResponse({ error: "Email service is not configured" }, 500);
  }

  const toEmail = getEnvValue(workerEnv, "CONTACT_TO_EMAIL") || DEFAULT_TO_EMAIL;
  const fromEmail = getEnvValue(workerEnv, "RESEND_FROM_EMAIL") || DEFAULT_FROM_EMAIL;

  const resendResponse = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: fromEmail,
      to: [toEmail],
      reply_to: payload.email,
      subject: `Portfolio contact from ${payload.name}`,
      text: `Name: ${payload.name}\nEmail: ${payload.email}\n\nMessage:\n${payload.message}`,
    }),
  });

  if (!resendResponse.ok) {
    const errorText = await resendResponse.text();
    console.error("Resend API error", resendResponse.status, errorText);
    return jsonResponse({ error: "Failed to send email" }, 502);
  }

  return jsonResponse({ ok: true });
}

/* ---------------- Content + Admin APIs ---------------- */

/** Stream-capped body read: never buffer more than maxBytes into memory. */
async function readBodyTextCapped(request: Request, maxBytes: number): Promise<string | null> {
  try {
    if (!request.body) {
      const text = await request.text();
      return text.length <= maxBytes ? text : null;
    }
    const reader = request.body.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        total += value.byteLength;
        if (total > maxBytes) {
          await reader.cancel().catch(() => {});
          return null;
        }
        chunks.push(value);
      }
    } finally {
      reader.releaseLock();
    }
    const buf = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
      buf.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return new TextDecoder().decode(buf);
  } catch {
    return null;
  }
}

async function readJson(request: Request): Promise<unknown> {
  try {
    const text = await readBodyTextCapped(request, MAX_JSON_BYTES);
    if (text === null) return undefined;
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

function publicCacheHeaders(): HeadersInit {
  return { "cache-control": "public, max-age=60, s-maxage=300" };
}

function noStoreHeaders(): HeadersInit {
  return { "cache-control": "no-store" };
}

const CONTENT_COLUMNS =
  "id, kind, title, subtitle, description, url, image, tags, meta, sort_order, is_visible, created_at, updated_at";

export type ContentSource = "db" | "seed" | "empty";

async function queryVisibleContent(
  db: D1Database | null,
  kind: ContentKind,
): Promise<{ items: ContentItem[]; source: ContentSource }> {
  // Single-statement snapshot: visible rows AND the total count must come
  // from the same read, otherwise two sequential queries can straddle D1
  // replication states (visible=∅ on a stale replica, count>0 fresh) and
  // briefly report an empty section that never existed.
  const snapshot = (rows: ContentItem[]): { items: ContentItem[]; source: ContentSource } => {
    const visible = sortContent(rows.filter((r) => r.is_visible));
    if (visible.length > 0) return { items: visible, source: "db" };
    if (rows.length > 0) return { items: [], source: "db" }; // admin hid everything: respect it
    const seeds = SEEDS[kind].filter((s) => s.is_visible);
    return seeds.length > 0 ? { items: seeds, source: "seed" } : { items: [], source: "empty" };
  };

  if (db) {
    try {
      const res = await db
        .prepare(
          `SELECT ${CONTENT_COLUMNS} FROM content_items WHERE kind = ? ORDER BY sort_order ASC, id ASC`,
        )
        .bind(kind)
        .all<Record<string, unknown>>();
      return snapshot(res.results.map(rowToContentItem));
    } catch (error) {
      console.error("D1 content query failed, falling back to seed", error);
    }
  }
  seedFallbackContent();
  return snapshot(
    [...fallbackContent.values()].filter((r) => r.kind === kind).map(rowToContentItem),
  );
}

async function queryAllContent(
  db: D1Database | null,
  kind: ContentKind | "all",
): Promise<ContentItem[]> {
  if (db) {
    try {
      const res =
        kind === "all"
          ? await db
              .prepare(
                `SELECT ${CONTENT_COLUMNS} FROM content_items ORDER BY kind ASC, sort_order ASC, id ASC`,
              )
              .all<Record<string, unknown>>()
          : await db
              .prepare(
                `SELECT ${CONTENT_COLUMNS} FROM content_items WHERE kind = ? ORDER BY sort_order ASC, id ASC`,
              )
              .bind(kind)
              .all<Record<string, unknown>>();
      return res.results.map(rowToContentItem);
    } catch (error) {
      console.error("D1 admin content query failed", error);
      return [];
    }
  }
  seedFallbackContent();
  const rows = [...fallbackContent.values()].map(rowToContentItem);
  const filtered = kind === "all" ? rows : rows.filter((i) => i.kind === kind);
  return filtered.sort((a, b) =>
    kind === "all"
      ? a.kind.localeCompare(b.kind) || a.sort_order - b.sort_order
      : a.sort_order - b.sort_order,
  );
}

async function handleContentRequest(request: Request, env: unknown): Promise<Response> {
  if (request.method !== "GET") {
    return new Response("Method not allowed", {
      status: 405,
      headers: { allow: "GET", ...securityHeaders() },
    });
  }
  const url = new URL(request.url);
  const kindParam = url.searchParams.get("kind");
  if (!kindParam || !isContentKind(kindParam)) {
    return jsonResponse({ error: "Invalid kind. Use one of: " + CONTENT_KINDS.join(", ") }, 400);
  }
  const { items, source } = await queryVisibleContent(getDb(env), kindParam);
  // Never cache an empty answer: a transient empty read must not poison the
  // edge/browser cache and blank sections on reload. Non-empty answers carry
  // the source so clients can tell deliberate admin-hides (db) apart.
  return jsonResponse(
    { items, source },
    200,
    items.length > 0 ? publicCacheHeaders() : noStoreHeaders(),
  );
}

type AdminUser = { id: number; username: string };

function pruneFallbackSessions() {
  const now = Date.now();
  for (const [tokenHash, s] of fallbackSessions) {
    if (s.expiresAt < now) fallbackSessions.delete(tokenHash);
  }
}

async function getSessionUser(request: Request, env: unknown): Promise<AdminUser | null> {
  const token = getSessionTokenFromCookie(request);
  if (!token) return null;
  const db = getDb(env);
  const now = Date.now();

  if (db) {
    try {
      const tokenHash = await sha256Hex(token);
      const row = await db
        .prepare("SELECT token_hash, user_id, expires_at FROM admin_sessions WHERE token_hash = ?")
        .bind(tokenHash)
        .first<{ token_hash: string; user_id: number; expires_at: number }>();
      if (!row || row.expires_at < now) {
        if (row) {
          await db
            .prepare("DELETE FROM admin_sessions WHERE token_hash = ?")
            .bind(tokenHash)
            .run()
            .catch(() => {});
        }
        return null;
      }
      const user = await db
        .prepare("SELECT id, username FROM admin_users WHERE id = ?")
        .bind(row.user_id)
        .first<{ id: number; username: string }>();
      if (!user) return null;
      return { id: user.id, username: user.username };
    } catch (error) {
      console.error("Session lookup failed", error);
      return null;
    }
  }

  pruneFallbackSessions();
  const tokenHash = await sha256Hex(token).catch(() => null);
  if (!tokenHash) return null;
  const session = fallbackSessions.get(tokenHash);
  if (!session || session.expiresAt < now) {
    if (session) fallbackSessions.delete(tokenHash);
    return null;
  }
  return { id: session.userId, username: session.username };
}

async function createSession(env: unknown, user: AdminUser): Promise<string> {
  const token = newSessionToken();
  const tokenHash = await sha256Hex(token);
  const expiresAt = Date.now() + SESSION_TTL_MS;
  const db = getDb(env);
  if (db) {
    await db
      .prepare(
        "INSERT INTO admin_sessions (token_hash, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)",
      )
      .bind(tokenHash, user.id, expiresAt, Date.now())
      .run();
    // Opportunistic cleanup of expired sessions.
    db.prepare("DELETE FROM admin_sessions WHERE expires_at < ?")
      .bind(Date.now())
      .run()
      .catch(() => {});
  } else {
    pruneFallbackSessions();
    fallbackSessions.set(tokenHash, { username: user.username, userId: user.id, expiresAt });
  }
  return token;
}

async function destroySession(request: Request, env: unknown): Promise<void> {
  const token = getSessionTokenFromCookie(request);
  if (!token) return;
  const db = getDb(env);
  const tokenHash = await sha256Hex(token).catch(() => null);
  if (!tokenHash) return;
  if (db) {
    await db
      .prepare("DELETE FROM admin_sessions WHERE token_hash = ?")
      .bind(tokenHash)
      .run()
      .catch(() => {});
  } else {
    fallbackSessions.delete(tokenHash);
  }
}

/* ---------- Step-up verification (emailed one-time codes) ---------- */

type OtpRow = {
  id: number;
  user_id: number;
  code_hash: string;
  expires_at: number;
  attempts: number;
  used: number;
  created_at: number;
};

function getAlertEmail(env: unknown): string {
  const workerEnv = getWorkerEnv(env);
  return (
    getEnvValue(workerEnv, "ADMIN_EMAIL") ||
    getEnvValue(workerEnv, "CONTACT_TO_EMAIL") ||
    DEFAULT_TO_EMAIL
  );
}

async function sendOtpEmail(env: unknown, to: string, code: string): Promise<boolean> {
  const workerEnv = getWorkerEnv(env);
  const resendApiKey = getEnvValue(workerEnv, "RESEND_API_KEY");
  if (!resendApiKey) return false;
  const fromEmail = getEnvValue(workerEnv, "RESEND_FROM_EMAIL") || DEFAULT_FROM_EMAIL;
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [to],
        subject: "Your portfolio admin verification code",
        text: `Your verification code is: ${code}\n\nIt expires in 10 minutes. If you did not request this, someone may have your admin password — sign in and change it immediately, then revoke sessions by changing the password.`,
      }),
    });
    if (!res.ok) {
      console.error("Resend OTP error", res.status, await res.text().catch(() => ""));
      return false;
    }
    return true;
  } catch (error) {
    console.error("Resend OTP send failed", error);
    return false;
  }
}

/** Latest live OTP row for a user, if any. */
async function getLiveOtp(db: D1Database, userId: number): Promise<OtpRow | null> {
  const now = Date.now();
  const row = await db
    .prepare(
      "SELECT id, user_id, code_hash, expires_at, attempts, used, created_at FROM admin_otps WHERE user_id = ? AND used = 0 AND expires_at > ? ORDER BY id DESC LIMIT 1",
    )
    .bind(userId, now)
    .first<OtpRow>();
  return row;
}

async function destroyGrant(request: Request, env: unknown): Promise<void> {
  const token = getGrantTokenFromCookie(request);
  if (!token) return;
  const tokenHash = await sha256Hex(token).catch(() => null);
  if (!tokenHash) return;
  const db = getDb(env);
  if (!db) return; // fallback mode keeps no grants
  await db
    .prepare("DELETE FROM admin_grants WHERE token_hash = ?")
    .bind(tokenHash)
    .run()
    .catch(() => {});
}

async function destroyAllUserGrants(db: D1Database, userId: number): Promise<void> {
  await db
    .prepare("DELETE FROM admin_grants WHERE user_id = ?")
    .bind(userId)
    .run()
    .catch(() => {});
  await db
    .prepare("DELETE FROM admin_otps WHERE user_id = ?")
    .bind(userId)
    .run()
    .catch(() => {});
  await db
    .prepare("DELETE FROM admin_grants WHERE expires_at < ?")
    .bind(Date.now())
    .run()
    .catch(() => {});
}

/** Current verified grant for this request, if any. */
async function getGrantUser(request: Request, env: unknown): Promise<AdminUser | null> {
  const db = getDb(env);
  if (!db) return null; // caller decides fallback behavior
  const token = getGrantTokenFromCookie(request);
  if (!token) return null;
  try {
    const tokenHash = await sha256Hex(token);
    const row = await db
      .prepare("SELECT token_hash, user_id, expires_at FROM admin_grants WHERE token_hash = ?")
      .bind(tokenHash)
      .first<{ token_hash: string; user_id: number; expires_at: number }>();
    if (!row || row.expires_at < Date.now()) {
      if (row) {
        await db
          .prepare("DELETE FROM admin_grants WHERE token_hash = ?")
          .bind(tokenHash)
          .run()
          .catch(() => {});
      }
      return null;
    }
    const user = await db
      .prepare("SELECT id, username FROM admin_users WHERE id = ?")
      .bind(row.user_id)
      .first<{ id: number; username: string }>();
    if (!user) return null;
    return { id: user.id, username: user.username };
  } catch (error) {
    console.error("Grant lookup failed", error);
    return null;
  }
}

/**
 * Step-up gate for mutations. Requires a live verified grant bound to the
 * same user as the session. In local fallback mode (no D1) there is no
 * email channel, so the gate is waived — production always enforces it.
 */
async function requireGrant(
  request: Request,
  env: unknown,
  user: AdminUser,
): Promise<AdminUser | Response> {
  if (getDb(env) === null) return user;
  const grant = await getGrantUser(request, env);
  if (!grant || grant.id !== user.id) {
    return jsonResponse({ error: OTP_REQUIRED_ERROR, code: "OTP_REQUIRED" }, 403);
  }
  return grant;
}

async function findAdminByUsername(
  env: unknown,
  username: string,
): Promise<{ id: number; username: string; password_hash: string; salt: string } | null> {
  const db = getDb(env);
  if (db) {
    try {
      const row = await db
        .prepare("SELECT id, username, password_hash, salt FROM admin_users WHERE username = ?")
        .bind(username)
        .first<{ id: number; username: string; password_hash: string; salt: string }>();
      return row;
    } catch (error) {
      console.error("Admin lookup failed", error);
      return null;
    }
  }
  // Fallback: single admin from env (local dev before D1 setup).
  const workerEnv = getWorkerEnv(env);
  const envUser = getEnvValue(workerEnv, "ADMIN_USERNAME")?.toLowerCase();
  const envHash = getEnvValue(workerEnv, "ADMIN_PASSWORD_HASH");
  const envSalt = getEnvValue(workerEnv, "ADMIN_PASSWORD_SALT");
  if (envUser && envHash && envSalt && username === envUser) {
    return { id: 1, username: envUser, password_hash: envHash, salt: envSalt };
  }
  return null;
}

async function hasAnyAdmin(env: unknown): Promise<boolean> {
  const db = getDb(env);
  if (db) {
    try {
      const row = await db
        .prepare("SELECT COUNT(*) as count FROM admin_users")
        .first<{ count: number }>();
      return (row?.count ?? 0) > 0;
    } catch {
      return false;
    }
  }
  const workerEnv = getWorkerEnv(env);
  return Boolean(
    getEnvValue(workerEnv, "ADMIN_USERNAME") &&
    getEnvValue(workerEnv, "ADMIN_PASSWORD_HASH") &&
    getEnvValue(workerEnv, "ADMIN_PASSWORD_SALT"),
  );
}

async function handleAdminLogin(request: Request, env: unknown): Promise<Response> {
  const secure = isSecureRequest(request);
  if (!isAllowedAdminOrigin(request)) {
    return jsonResponse({ error: "Forbidden origin." }, 403);
  }
  if (isLoginRateLimited(request)) {
    return jsonResponse({ error: "Too many attempts. Try again in 10 minutes." }, 429);
  }
  const body = await readJson(request);
  const data = (body ?? {}) as Record<string, unknown>;
  const username = normalizeUsername(data.username);
  const password = typeof data.password === "string" ? data.password : "";

  if (!username || !password || password.length > 256) {
    // Generic message + dummy work (avoids user enumeration).
    await sha256Hex("dummy").catch(() => {});
    return jsonResponse({ error: GENERIC_AUTH_ERROR }, 401);
  }

  const admin = await findAdminByUsername(env, username);
  if (!admin) {
    // Equalize timing: a full dummy PBKDF2 run so unknown usernames take
    // as long as real password checks (blocks timing-based enumeration).
    await verifyPassword(password, DUMMY_SALT_HEX, DUMMY_HASH_HEX).catch(() => false);
    return jsonResponse({ error: GENERIC_AUTH_ERROR }, 401);
  }
  const valid = await verifyPassword(password, admin.salt, admin.password_hash);
  if (!valid) {
    return jsonResponse({ error: GENERIC_AUTH_ERROR }, 401);
  }

  const token = await createSession(env, { id: admin.id, username: admin.username });
  return jsonResponse({ ok: true, user: { username: admin.username } }, 200, {
    "set-cookie": buildSessionCookie(token, secure),
  });
}

async function requireAdmin(request: Request, env: unknown): Promise<AdminUser | Response> {
  if (!isAllowedAdminOrigin(request)) {
    return jsonResponse({ error: "Forbidden origin." }, 403);
  }
  const user = await getSessionUser(request, env);
  if (!user) return jsonResponse({ error: "Unauthorized." }, 401);
  return user;
}

async function handleOtpRequest(request: Request, env: unknown): Promise<Response> {
  const user = await requireAdmin(request, env);
  if (user instanceof Response) return user;
  const db = getDb(env);
  if (!db) {
    return jsonResponse(
      { error: "Step-up codes need D1 + email. Local fallback mode skips this step." },
      501,
    );
  }
  const now = Date.now();
  try {
    const recent = await db
      .prepare(
        "SELECT id, created_at FROM admin_otps WHERE user_id = ? AND created_at > ? ORDER BY id DESC",
      )
      .bind(user.id, now - 60 * 60 * 1000)
      .all<{ id: number; created_at: number }>();
    if (recent.results.length >= OTP_MAX_SEND_PER_HOUR) {
      return jsonResponse({ error: "Too many codes requested. Try again in an hour." }, 429);
    }
    const latest = recent.results[0];
    if (latest && now - latest.created_at < OTP_MIN_RESEND_MS) {
      return jsonResponse({ error: "A code was just sent. Wait a minute." }, 429);
    }

    const workerEnv = getWorkerEnv(env);
    if (!getEnvValue(workerEnv, "RESEND_API_KEY")) {
      return jsonResponse(
        { error: "Email is not configured. Set RESEND_API_KEY / ADMIN_EMAIL." },
        501,
      );
    }

    // Invalidate any previous live code before issuing a new one.
    await db
      .prepare("UPDATE admin_otps SET used = 1 WHERE user_id = ? AND used = 0")
      .bind(user.id)
      .run();

    const code = newOtpCode();
    const codeHash = await sha256Hex(code);
    await db
      .prepare(
        "INSERT INTO admin_otps (user_id, code_hash, expires_at, attempts, used, created_at) VALUES (?, ?, ?, 0, 0, ?)",
      )
      .bind(user.id, codeHash, now + OTP_TTL_MS, now)
      .run();

    const sent = await sendOtpEmail(env, getAlertEmail(env), code);
    if (!sent) {
      await db
        .prepare("UPDATE admin_otps SET used = 1 WHERE user_id = ? AND code_hash = ?")
        .bind(user.id, codeHash)
        .run()
        .catch(() => {});
      return jsonResponse({ error: "Failed to send the code. Try again shortly." }, 502);
    }
    return jsonResponse({ ok: true, expiresIn: Math.floor(OTP_TTL_MS / 1000) });
  } catch (error) {
    console.error("OTP request failed", error);
    return jsonResponse({ error: "Failed to issue a code." }, 500);
  }
}

async function handleOtpVerify(request: Request, env: unknown): Promise<Response> {
  const user = await requireAdmin(request, env);
  if (user instanceof Response) return user;
  const db = getDb(env);
  if (!db) {
    return jsonResponse(
      { error: "Step-up codes need D1. Local fallback mode skips this step." },
      501,
    );
  }
  if (
    hitRateLimit(
      otpVerifyRateLimitStore,
      `otp:${getClientIp(request)}`,
      OTP_VERIFY_IP_WINDOW_MS,
      OTP_VERIFY_IP_MAX,
    )
  ) {
    return jsonResponse({ error: "Too many attempts. Try again in 10 minutes." }, 429);
  }
  const body = ((await readJson(request)) ?? {}) as Record<string, unknown>;
  const code = body.code;
  const now = Date.now();
  const fail = () => jsonResponse({ error: "Invalid or expired code." }, 401);
  try {
    if (!isOtpCode(code)) {
      await sha256Hex("dummy-code").catch(() => {});
      return fail();
    }
    const row = await getLiveOtp(db, user.id);
    if (!row) return fail();
    if (row.attempts >= OTP_MAX_ATTEMPTS) {
      await db.prepare("UPDATE admin_otps SET used = 1 WHERE id = ?").bind(row.id).run();
      return jsonResponse(
        { error: "Code locked after too many attempts. Request a new one." },
        403,
      );
    }
    const candidateHash = await sha256Hex(code);
    if (!timingSafeEqualHex(candidateHash, row.code_hash)) {
      await db
        .prepare("UPDATE admin_otps SET attempts = attempts + 1 WHERE id = ?")
        .bind(row.id)
        .run();
      return fail();
    }
    await db.prepare("UPDATE admin_otps SET used = 1 WHERE id = ?").bind(row.id).run();

    const token = newSessionToken();
    const tokenHash = await sha256Hex(token);
    const expiresAt = now + GRANT_TTL_MS;
    await db
      .prepare(
        "INSERT INTO admin_grants (token_hash, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)",
      )
      .bind(tokenHash, user.id, expiresAt, now)
      .run();
    return jsonResponse({ ok: true, expiresAt }, 200, {
      "set-cookie": buildGrantCookie(token, isSecureRequest(request)),
    });
  } catch (error) {
    console.error("OTP verify failed", error);
    return jsonResponse({ error: "Verification failed." }, 500);
  }
}

async function handleOtpStatus(request: Request, env: unknown): Promise<Response> {
  const user = await requireAdmin(request, env);
  if (user instanceof Response) return user;
  if (getDb(env) === null) {
    return jsonResponse({ verified: false, expiresAt: null, stepUp: false });
  }
  const grant = await getGrantUser(request, env);
  if (!grant || grant.id !== user.id) {
    return jsonResponse({ verified: false, expiresAt: null, stepUp: true });
  }
  const db = getDb(env)!;
  const token = getGrantTokenFromCookie(request);
  const tokenHash = token ? await sha256Hex(token).catch(() => "") : "";
  const row = await db
    .prepare("SELECT expires_at FROM admin_grants WHERE token_hash = ?")
    .bind(tokenHash)
    .first<{ expires_at: number }>()
    .catch(() => null);
  return jsonResponse({ verified: true, expiresAt: row?.expires_at ?? null, stepUp: true });
}

async function handleOtpRevoke(request: Request, env: unknown): Promise<Response> {
  const user = await requireAdmin(request, env);
  if (user instanceof Response) return user;
  await destroyGrant(request, env);
  return jsonResponse({ ok: true }, 200, {
    "set-cookie": buildClearedGrantCookie(isSecureRequest(request)),
  });
}

function parseId(id: string): number | null {
  // Content ids are positive integers; anything else is rejected so
  // read-only seed placeholders (e.g. "seed-…") can never be edited.
  const n = Number(id);
  if (!Number.isInteger(n) || n <= 0) return null;
  return n;
}

async function handleAdminItems(request: Request, env: unknown, url: URL): Promise<Response> {
  const user = await requireAdmin(request, env);
  if (user instanceof Response) return user;
  const db = getDb(env);

  if (request.method === "GET") {
    const kindParam = url.searchParams.get("kind") ?? "all";
    if (kindParam !== "all" && !isContentKind(kindParam)) {
      return jsonResponse({ error: "Invalid kind." }, 400);
    }
    const items = await queryAllContent(db, kindParam as ContentKind | "all");
    return jsonResponse({ items });
  }

  if (request.method === "POST") {
    const grant = await requireGrant(request, env, user);
    if (grant instanceof Response) return grant;
    const body = await readJson(request);
    const validated = validateContentInput(body);
    if (!validated.ok) return jsonResponse({ error: validated.error }, 400);
    const v = validated.value;
    const now = Date.now();
    if (db) {
      try {
        const result = await db
          .prepare(
            "INSERT INTO content_items (kind, title, subtitle, description, url, image, tags, meta, sort_order, is_visible, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
          )
          .bind(
            v.kind,
            v.title,
            v.subtitle ?? "",
            v.description ?? "",
            v.url ?? "",
            v.image ?? "",
            JSON.stringify(v.tags ?? []),
            JSON.stringify(v.meta ?? {}),
            v.sort_order ?? 0,
            v.is_visible === false ? 0 : 1,
            now,
            now,
          )
          .run();
        return jsonResponse({ ok: true, id: result.meta?.last_row_id ?? null }, 201);
      } catch (error) {
        console.error("Insert content failed", error);
        return jsonResponse({ error: "Failed to create item." }, 500);
      }
    }
    seedFallbackContent();
    const id = fallbackContentSeq++;
    fallbackContent.set(id, {
      id,
      kind: v.kind,
      title: v.title,
      subtitle: v.subtitle ?? "",
      description: v.description ?? "",
      url: v.url ?? "",
      image: v.image ?? "",
      tags: JSON.stringify(v.tags ?? []),
      meta: JSON.stringify(v.meta ?? {}),
      sort_order: v.sort_order ?? 0,
      is_visible: v.is_visible === false ? 0 : 1,
      created_at: now,
      updated_at: now,
    });
    return jsonResponse({ ok: true, id }, 201);
  }

  return new Response("Method not allowed", {
    status: 405,
    headers: { allow: "GET, POST", ...securityHeaders() },
  });
}

async function handleAdminItemById(
  request: Request,
  env: unknown,
  idStr: string,
): Promise<Response> {
  const user = await requireAdmin(request, env);
  if (user instanceof Response) return user;
  const db = getDb(env);
  const id = parseId(idStr);
  if (id === null) {
    return jsonResponse(
      { error: "Seed items are read-only. Add a new item to override them." },
      400,
    );
  }
  const grant = await requireGrant(request, env, user);
  if (grant instanceof Response) return grant;

  if (request.method === "PUT") {
    const body = await readJson(request);
    const validated = validateContentInput(body);
    if (!validated.ok) return jsonResponse({ error: validated.error }, 400);
    const v = validated.value;
    const now = Date.now();
    if (db) {
      try {
        await db
          .prepare(
            "UPDATE content_items SET kind = ?, title = ?, subtitle = ?, description = ?, url = ?, image = ?, tags = ?, meta = ?, sort_order = ?, is_visible = ?, updated_at = ? WHERE id = ?",
          )
          .bind(
            v.kind,
            v.title,
            v.subtitle ?? "",
            v.description ?? "",
            v.url ?? "",
            v.image ?? "",
            JSON.stringify(v.tags ?? []),
            JSON.stringify(v.meta ?? {}),
            v.sort_order ?? 0,
            v.is_visible === false ? 0 : 1,
            now,
            id,
          )
          .run();
        return jsonResponse({ ok: true });
      } catch (error) {
        console.error("Update content failed", error);
        return jsonResponse({ error: "Failed to update item." }, 500);
      }
    }
    const existing = fallbackContent.get(id);
    if (!existing) return jsonResponse({ error: "Not found." }, 404);
    fallbackContent.set(id, {
      ...existing,
      kind: v.kind,
      title: v.title,
      subtitle: v.subtitle ?? "",
      description: v.description ?? "",
      url: v.url ?? "",
      image: v.image ?? "",
      tags: JSON.stringify(v.tags ?? []),
      meta: JSON.stringify(v.meta ?? {}),
      sort_order: v.sort_order ?? 0,
      is_visible: v.is_visible === false ? 0 : 1,
      updated_at: now,
    });
    return jsonResponse({ ok: true });
  }

  if (request.method === "DELETE") {
    if (db) {
      try {
        await db.prepare("DELETE FROM content_items WHERE id = ?").bind(id).run();
        return jsonResponse({ ok: true });
      } catch (error) {
        console.error("Delete content failed", error);
        return jsonResponse({ error: "Failed to delete item." }, 500);
      }
    }
    if (!fallbackContent.delete(id)) return jsonResponse({ error: "Not found." }, 404);
    return jsonResponse({ ok: true });
  }

  return new Response("Method not allowed", {
    status: 405,
    headers: { allow: "PUT, DELETE", ...securityHeaders() },
  });
}

async function handleAdminReorder(request: Request, env: unknown): Promise<Response> {
  const user = await requireAdmin(request, env);
  if (user instanceof Response) return user;
  const grant = await requireGrant(request, env, user);
  if (grant instanceof Response) return grant;
  const body = (await readJson(request)) as Record<string, unknown> | undefined;
  const kind = body?.kind;
  const ids = body?.ids;
  if (!isContentKind(kind) || !Array.isArray(ids) || ids.length === 0 || ids.length > 200) {
    return jsonResponse({ error: "Provide { kind, ids: number[] }." }, 400);
  }
  const numericIds: number[] = [];
  for (const raw of ids) {
    const n = typeof raw === "number" ? raw : Number(raw);
    if (!Number.isInteger(n) || n <= 0)
      return jsonResponse({ error: "Invalid id in order list." }, 400);
    numericIds.push(n);
  }
  const now = Date.now();
  const db = getDb(env);
  if (db) {
    try {
      if (db.batch) {
        await db.batch(
          numericIds.map((id, index) =>
            db
              .prepare(
                "UPDATE content_items SET sort_order = ?, updated_at = ? WHERE id = ? AND kind = ?",
              )
              .bind(index + 1, now, id, kind),
          ),
        );
      } else {
        for (let index = 0; index < numericIds.length; index++) {
          await db
            .prepare(
              "UPDATE content_items SET sort_order = ?, updated_at = ? WHERE id = ? AND kind = ?",
            )
            .bind(index + 1, now, numericIds[index], kind)
            .run();
        }
      }
      return jsonResponse({ ok: true });
    } catch (error) {
      console.error("Reorder failed", error);
      return jsonResponse({ error: "Failed to reorder." }, 500);
    }
  }
  numericIds.forEach((id, index) => {
    const row = fallbackContent.get(id);
    if (row && row.kind === kind) {
      fallbackContent.set(id, { ...row, sort_order: index + 1, updated_at: now });
    }
  });
  return jsonResponse({ ok: true });
}

async function handleAdminSeedImport(request: Request, env: unknown): Promise<Response> {
  const user = await requireAdmin(request, env);
  if (user instanceof Response) return user;
  const grant = await requireGrant(request, env, user);
  if (grant instanceof Response) return grant;
  const db = getDb(env);
  if (!db) {
    return jsonResponse({ error: "Seed import needs D1. Nothing was changed." }, 501);
  }
  const body = ((await readJson(request)) ?? {}) as Record<string, unknown>;
  const kind = body.kind ?? "certification";
  if (!isContentKind(kind)) {
    return jsonResponse({ error: "Invalid kind." }, 400);
  }
  const seeds = SEEDS[kind];
  if (seeds.length === 0) {
    return jsonResponse({ error: `No seeds exist for ${kind}. Add items manually instead.` }, 400);
  }
  try {
    const count = await db
      .prepare("SELECT COUNT(*) as count FROM content_items WHERE kind = ?")
      .bind(kind)
      .first<{ count: number }>();
    if ((count?.count ?? 0) > 0) {
      return jsonResponse(
        { error: "Items already exist in D1. Import runs only once on an empty table." },
        409,
      );
    }
    const now = Date.now();
    for (const seed of seeds) {
      await db
        .prepare(
          "INSERT INTO content_items (kind, title, subtitle, description, url, image, tags, meta, sort_order, is_visible, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(
          seed.kind,
          seed.title,
          seed.subtitle,
          seed.description,
          seed.url,
          seed.image,
          JSON.stringify(seed.tags),
          JSON.stringify(seed.meta ?? {}),
          seed.sort_order,
          1,
          now,
          now,
        )
        .run();
    }
    return jsonResponse({ ok: true, imported: seeds.length }, 201);
  } catch (error) {
    console.error("Seed import failed", error);
    return jsonResponse({ error: "Failed to import seeds." }, 500);
  }
}

async function readSettings(db: D1Database | null): Promise<Record<string, string>> {
  const overrides: Record<string, string> = {};
  if (db) {
    try {
      const res = await db
        .prepare("SELECT key, value FROM site_settings")
        .all<{ key: string; value: string }>();
      for (const row of res.results) {
        if (typeof row.key === "string" && typeof row.value === "string") {
          overrides[row.key] = row.value;
        }
      }
    } catch (error) {
      console.error("Settings read failed, using defaults", error);
    }
  } else {
    Object.assign(overrides, fallbackSettings);
  }
  return mergeSettings(overrides);
}

async function handleSettingsRequest(request: Request, env: unknown): Promise<Response> {
  if (request.method !== "GET") {
    return new Response("Method not allowed", {
      status: 405,
      headers: { allow: "GET", ...securityHeaders() },
    });
  }
  const settings = await readSettings(getDb(env));
  return jsonResponse({ settings }, 200, publicCacheHeaders());
}

async function handleAdminSettings(request: Request, env: unknown): Promise<Response> {
  const user = await requireAdmin(request, env);
  if (user instanceof Response) return user;

  if (request.method === "GET") {
    return jsonResponse({ settings: await readSettings(getDb(env)) });
  }

  if (request.method === "PUT" || request.method === "POST") {
    const grant = await requireGrant(request, env, user);
    if (grant instanceof Response) return grant;
    const body = ((await readJson(request)) ?? {}) as Record<string, unknown>;
    const key = typeof body.key === "string" ? body.key : "";
    const validated = validateSettingValue(key, body.value);
    if (!validated.ok) return jsonResponse({ error: validated.error }, 400);
    const db = getDb(env);
    const now = Date.now();
    if (db) {
      try {
        await db
          .prepare(
            "INSERT INTO site_settings (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at",
          )
          .bind(key, validated.value, now)
          .run();
        return jsonResponse({ ok: true });
      } catch (error) {
        console.error("Settings save failed", error);
        return jsonResponse({ error: "Failed to save setting." }, 500);
      }
    }
    fallbackSettings[key] = validated.value;
    return jsonResponse({ ok: true });
  }

  return new Response("Method not allowed", {
    status: 405,
    headers: { allow: "GET, PUT", ...securityHeaders() },
  });
}

async function handleAdminSettingDelete(
  request: Request,
  env: unknown,
  key: string,
): Promise<Response> {
  const user = await requireAdmin(request, env);
  if (user instanceof Response) return user;
  if (!isSettingKey(key)) return jsonResponse({ error: "Unknown setting key." }, 400);
  const grant = await requireGrant(request, env, user);
  if (grant instanceof Response) return grant;
  const db = getDb(env);
  if (db) {
    try {
      await db.prepare("DELETE FROM site_settings WHERE key = ?").bind(key).run();
      return jsonResponse({ ok: true });
    } catch (error) {
      console.error("Settings reset failed", error);
      return jsonResponse({ error: "Failed to reset setting." }, 500);
    }
  }
  delete fallbackSettings[key];
  return jsonResponse({ ok: true });
}

async function handleAdminPassword(request: Request, env: unknown): Promise<Response> {
  const user = await requireAdmin(request, env);
  if (user instanceof Response) return user;
  if (getDb(env) === null) {
    return jsonResponse(
      {
        error:
          "Password change needs D1. Set it up, or rotate ADMIN_PASSWORD_HASH/SALT in .dev.vars.",
      },
      501,
    );
  }
  const grant = await requireGrant(request, env, user);
  if (grant instanceof Response) return grant;
  const body = ((await readJson(request)) ?? {}) as Record<string, unknown>;
  const currentPassword = typeof body.currentPassword === "string" ? body.currentPassword : "";
  const newPassword = body.newPassword;
  if (!validateNewPassword(newPassword)) {
    return jsonResponse({ error: PASSWORD_POLICY_MESSAGE }, 400);
  }
  const db = getDb(env)!;
  const admin = await findAdminByUsername(env, user.username);
  if (!admin || !(await verifyPassword(currentPassword, admin.salt, admin.password_hash))) {
    return jsonResponse({ error: "Current password is incorrect." }, 401);
  }
  const { hash, salt } = await hashPassword(newPassword as string);
  await db
    .prepare("UPDATE admin_users SET password_hash = ?, salt = ? WHERE id = ?")
    .bind(hash, salt, admin.id)
    .run();
  // Invalidate all other sessions for this user.
  const token = getSessionTokenFromCookie(request);
  const keepHash = token ? await sha256Hex(token).catch(() => "") : "";
  await db
    .prepare("DELETE FROM admin_sessions WHERE user_id = ? AND token_hash != ?")
    .bind(admin.id, keepHash)
    .run()
    .catch(() => {});
  // A password change ends all step-up grants too — re-verify afterwards.
  await destroyAllUserGrants(db, admin.id);
  return jsonResponse({ ok: true }, 200, {
    "set-cookie": buildClearedGrantCookie(isSecureRequest(request)),
  });
}

async function handleAdminRequest(request: Request, env: unknown): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname;

  if (path === "/api/admin/status" && request.method === "GET") {
    const db = getDb(env);
    let metaReady = true;
    if (db) {
      // Migration 0002 adds the meta column + site_settings. If it hasn't
      // been applied, content writes fail while reads fall back to seeds —
      // surface that explicitly instead of failing opaquely in /admin.
      try {
        await db.prepare("SELECT meta FROM content_items LIMIT 1").first();
      } catch {
        metaReady = false;
      }
    }
    return jsonResponse({
      db: Boolean(db),
      hasAdmin: await hasAnyAdmin(env),
      metaReady,
      stepUp: Boolean(db),
    });
  }
  if (path === "/api/admin/login" && request.method === "POST") {
    return handleAdminLogin(request, env);
  }
  if (path === "/api/admin/logout" && request.method === "POST") {
    await destroySession(request, env);
    await destroyGrant(request, env);
    const secure = isSecureRequest(request);
    // Two cookies: Headers.append keeps them as separate Set-Cookie lines
    // (comma-joining would corrupt them — browsers never split that).
    const headers = new Headers({
      "content-type": "application/json; charset=utf-8",
      ...securityHeaders(),
    });
    headers.append("set-cookie", buildClearedSessionCookie(secure));
    headers.append("set-cookie", buildClearedGrantCookie(secure));
    return new Response(JSON.stringify({ ok: true }), { status: 200, headers });
  }
  if (path === "/api/admin/otp/request" && request.method === "POST") {
    return handleOtpRequest(request, env);
  }
  if (path === "/api/admin/otp/verify" && request.method === "POST") {
    return handleOtpVerify(request, env);
  }
  if (path === "/api/admin/otp/status" && request.method === "GET") {
    return handleOtpStatus(request, env);
  }
  if (path === "/api/admin/otp/revoke" && request.method === "POST") {
    return handleOtpRevoke(request, env);
  }
  if (path === "/api/admin/me" && request.method === "GET") {
    const user = await getSessionUser(request, env);
    if (!user) return jsonResponse({ error: "Unauthorized." }, 401);
    return jsonResponse({ user });
  }
  if (path === "/api/admin/items" && (request.method === "GET" || request.method === "POST")) {
    return handleAdminItems(request, env, url);
  }
  if (path === "/api/admin/reorder" && request.method === "POST") {
    return handleAdminReorder(request, env);
  }
  if (path === "/api/admin/seed-import" && request.method === "POST") {
    return handleAdminSeedImport(request, env);
  }
  if (path === "/api/admin/settings" && ["GET", "PUT", "POST"].includes(request.method)) {
    return handleAdminSettings(request, env);
  }
  if (path === "/api/admin/password" && (request.method === "PUT" || request.method === "POST")) {
    return handleAdminPassword(request, env);
  }
  const itemMatch = path.match(/^\/api\/admin\/items\/([^/]+)$/);
  if (itemMatch && (request.method === "PUT" || request.method === "DELETE")) {
    let idStr: string;
    try {
      idStr = decodeURIComponent(itemMatch[1]!);
    } catch {
      return jsonResponse({ error: "Invalid id encoding." }, 400);
    }
    return handleAdminItemById(request, env, idStr);
  }
  const settingMatch = path.match(/^\/api\/admin\/settings\/([^/]+)$/);
  if (settingMatch && request.method === "DELETE") {
    let key: string;
    try {
      key = decodeURIComponent(settingMatch[1]!);
    } catch {
      return jsonResponse({ error: "Invalid key encoding." }, 400);
    }
    return handleAdminSettingDelete(request, env, key);
  }
  return jsonResponse({ error: "Not found." }, 404);
}

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then((m) => {
      const entry = (m as { default?: ServerEntry }).default;
      return entry ?? (m as unknown as ServerEntry);
    });
  }
  return serverEntryPromise;
}

function brandedErrorResponse(): Response {
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8", ...securityHeaders() },
  });
}

function isCatastrophicSsrErrorBody(body: string, responseStatus: number): boolean {
  let payload: unknown;
  try {
    payload = JSON.parse(body);
  } catch {
    return false;
  }

  if (!payload || Array.isArray(payload) || typeof payload !== "object") {
    return false;
  }

  const fields = payload as Record<string, unknown>;
  const expectedKeys = new Set(["message", "status", "unhandled"]);
  if (!Object.keys(fields).every((key) => expectedKeys.has(key))) {
    return false;
  }

  return (
    fields.unhandled === true &&
    fields.message === "HTTPError" &&
    (fields.status === undefined || fields.status === responseStatus)
  );
}

async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!isCatastrophicSsrErrorBody(body, response.status)) {
    return response;
  }

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return brandedErrorResponse();
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    try {
      const url = new URL(request.url);
      if (url.pathname === ROBOTS_PATH) {
        return robotsResponse();
      }
      if (url.pathname === SITEMAP_PATH) {
        return sitemapResponse();
      }
      if (url.pathname === CONTACT_API_PATH) {
        return await handleContactRequest(request, env);
      }
      if (url.pathname === CONTENT_API_PATH) {
        return await handleContentRequest(request, env);
      }
      if (url.pathname === SETTINGS_API_PATH) {
        return await handleSettingsRequest(request, env);
      }
      if (
        url.pathname === ADMIN_API_PREFIX.slice(0, -1) ||
        url.pathname.startsWith(ADMIN_API_PREFIX)
      ) {
        // Normalize "/api/admin" -> status 404 shape instead of SSR.
        if (url.pathname === "/api/admin") {
          return jsonResponse({ error: "Not found." }, 404);
        }
        return await handleAdminRequest(request, env);
      }

      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      const normalized = await normalizeCatastrophicSsrResponse(response);
      return withSecurityHeaders(normalized);
    } catch (error) {
      console.error(error);
      return brandedErrorResponse();
    }
  },
};
