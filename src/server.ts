import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";
import { site } from "./lib/site";
import {
  CONTENT_KINDS,
  SEED_CERTIFICATIONS,
  isContentKind,
  rowToContentItem,
  sortContent,
  validateContentInput,
  type ContentItem,
  type ContentKind,
} from "./lib/content";
import {
  SESSION_TTL_MS,
  buildClearedSessionCookie,
  buildSessionCookie,
  getSessionTokenFromCookie,
  hashPassword,
  isAllowedAdminOrigin,
  isSecureRequest,
  newSessionToken,
  normalizeUsername,
  sha256Hex,
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
};

const CONTACT_API_PATH = "/api/contact";
const CONTENT_API_PATH = "/api/content";
const ADMIN_API_PREFIX = "/api/admin/";
const ROBOTS_PATH = "/robots.txt";
const SITEMAP_PATH = "/sitemap.xml";
const DEFAULT_TO_EMAIL = "divyanshakya.dev@gmail.com";
const DEFAULT_FROM_EMAIL = "onboarding@resend.dev";
const DEFAULT_RATE_LIMIT_MAX = 5;
const DEFAULT_RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const LOGIN_RATE_LIMIT_MAX = 5;
const LOGIN_RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const GENERIC_AUTH_ERROR = "Invalid username or password.";
// Fixed dummy PBKDF2 operands: burned on every unknown-user login so valid
// and invalid usernames take the same time (timing-oracle defence).
const DUMMY_SALT_HEX = "00".repeat(16);
const DUMMY_HASH_HEX = "00".repeat(32);

let serverEntryPromise: Promise<ServerEntry> | undefined;
const contactRateLimitStore = new Map<string, number[]>();
const loginRateLimitStore = new Map<string, number[]>();

/* In-memory fallbacks for local dev before D1 is bound. Not for production. */
type FallbackSession = { username: string; userId: number; expiresAt: number };
const fallbackSessions = new Map<string, FallbackSession>();
type FallbackRow = Record<string, unknown>;
const fallbackContent = new Map<number, FallbackRow>();
let fallbackContentSeq = 1000;
let fallbackSeeded = false;

function seedFallbackContent() {
  if (fallbackSeeded) return;
  fallbackSeeded = true;
  const now = Date.now();
  for (const seed of SEED_CERTIFICATIONS) {
    fallbackContent.set(fallbackContentSeq++, {
      id: fallbackContentSeq,
      kind: seed.kind,
      title: seed.title,
      subtitle: seed.subtitle,
      description: seed.description,
      url: seed.url,
      image: seed.image,
      tags: JSON.stringify(seed.tags),
      sort_order: seed.sort_order,
      is_visible: 1,
      created_at: now,
      updated_at: now,
    });
  }
}

function jsonResponse(payload: unknown, status = 200, extraHeaders?: HeadersInit): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", ...(extraHeaders ?? {}) },
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
      headers: { allow: "POST" },
    });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
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

async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return undefined;
  }
}

function publicCacheHeaders(): HeadersInit {
  return { "cache-control": "public, max-age=60, s-maxage=300" };
}

async function queryVisibleContent(
  db: D1Database | null,
  kind: ContentKind,
): Promise<ContentItem[]> {
  if (db) {
    try {
      const res = await db
        .prepare(
          "SELECT id, kind, title, subtitle, description, url, image, tags, sort_order, is_visible, created_at, updated_at FROM content_items WHERE kind = ? AND is_visible = 1 ORDER BY sort_order ASC, id ASC",
        )
        .bind(kind)
        .all<Record<string, unknown>>();
      const items = sortContent(res.results.map(rowToContentItem));
      if (items.length > 0) return items;
      // No visible rows: distinguish "admin hid everything" (respect it)
      // from "admin never added this kind" (serve seeds for certifications).
      const count = await db
        .prepare("SELECT COUNT(*) as count FROM content_items WHERE kind = ?")
        .bind(kind)
        .first<{ count: number }>();
      if ((count?.count ?? 0) > 0) return [];
      if (kind === "certification") {
        return SEED_CERTIFICATIONS.filter((s) => s.is_visible);
      }
      return [];
    } catch (error) {
      console.error("D1 content query failed, falling back to seed", error);
    }
  }
  if (kind === "certification") {
    seedFallbackContent();
    const seeded = SEED_CERTIFICATIONS.filter((s) => s.is_visible);
    const extra = [...fallbackContent.values()]
      .filter((r) => r.kind === kind && Number(r.is_visible) === 1 && Number(r.id) >= 1000)
      .map(rowToContentItem);
    // In fallback mode without user rows, serve seeds. If admin added rows
    // in-memory, merge (dedupe by id).
    const seen = new Set(extra.map((e) => e.title));
    return sortContent([...extra, ...seeded.filter((s) => !seen.has(s.title))]);
  }
  if (!db) {
    seedFallbackContent();
    return sortContent(
      [...fallbackContent.values()]
        .filter((r) => r.kind === kind && Number(r.is_visible) === 1)
        .map(rowToContentItem)
        .filter((i) => !String(i.id).startsWith("seed")),
    );
  }
  return [];
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
                "SELECT id, kind, title, subtitle, description, url, image, tags, sort_order, is_visible, created_at, updated_at FROM content_items ORDER BY kind ASC, sort_order ASC, id ASC",
              )
              .all<Record<string, unknown>>()
          : await db
              .prepare(
                "SELECT id, kind, title, subtitle, description, url, image, tags, sort_order, is_visible, created_at, updated_at FROM content_items WHERE kind = ? ORDER BY sort_order ASC, id ASC",
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
  const withSeeds: ContentItem[] =
    kind === "all" || kind === "certification"
      ? [
          ...SEED_CERTIFICATIONS.filter((s) => kind === "all" || s.kind === kind),
          ...rows.filter((r) => !String(r.id).startsWith("seed")),
        ]
      : rows;
  return (kind === "all" ? withSeeds : withSeeds.filter((i) => i.kind === kind)).sort((a, b) =>
    kind === "all"
      ? a.kind.localeCompare(b.kind) || a.sort_order - b.sort_order
      : a.sort_order - b.sort_order,
  );
}

async function handleContentRequest(request: Request, env: unknown): Promise<Response> {
  if (request.method !== "GET") {
    return new Response("Method not allowed", { status: 405, headers: { allow: "GET" } });
  }
  const url = new URL(request.url);
  const kindParam = url.searchParams.get("kind");
  if (!kindParam || !isContentKind(kindParam)) {
    return jsonResponse({ error: "Invalid kind. Use one of: " + CONTENT_KINDS.join(", ") }, 400);
  }
  const items = await queryVisibleContent(getDb(env), kindParam);
  return jsonResponse({ items }, 200, publicCacheHeaders());
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

function parseId(id: string): number | null {
  // Seed rows (e.g. "seed-...") are read-only fallbacks — not editable.
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
    const body = await readJson(request);
    const validated = validateContentInput(body);
    if (!validated.ok) return jsonResponse({ error: validated.error }, 400);
    const v = validated.value;
    const now = Date.now();
    if (db) {
      try {
        const result = await db
          .prepare(
            "INSERT INTO content_items (kind, title, subtitle, description, url, image, tags, sort_order, is_visible, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
          )
          .bind(
            v.kind,
            v.title,
            v.subtitle ?? "",
            v.description ?? "",
            v.url ?? "",
            v.image ?? "",
            JSON.stringify(v.tags ?? []),
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
      sort_order: v.sort_order ?? 0,
      is_visible: v.is_visible === false ? 0 : 1,
      created_at: now,
      updated_at: now,
    });
    return jsonResponse({ ok: true, id }, 201);
  }

  return new Response("Method not allowed", { status: 405, headers: { allow: "GET, POST" } });
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
            "UPDATE content_items SET kind = ?, title = ?, subtitle = ?, description = ?, url = ?, image = ?, tags = ?, sort_order = ?, is_visible = ?, updated_at = ? WHERE id = ?",
          )
          .bind(
            v.kind,
            v.title,
            v.subtitle ?? "",
            v.description ?? "",
            v.url ?? "",
            v.image ?? "",
            JSON.stringify(v.tags ?? []),
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

  return new Response("Method not allowed", { status: 405, headers: { allow: "PUT, DELETE" } });
}

async function handleAdminReorder(request: Request, env: unknown): Promise<Response> {
  const user = await requireAdmin(request, env);
  if (user instanceof Response) return user;
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
  const db = getDb(env);
  if (!db) {
    return jsonResponse({ error: "Seed import needs D1. Nothing was changed." }, 501);
  }
  const body = ((await readJson(request)) ?? {}) as Record<string, unknown>;
  // Only certifications have seeds today; validated explicitly.
  if (body.kind !== undefined && body.kind !== "certification") {
    return jsonResponse({ error: "Only certification seeds can be imported." }, 400);
  }
  try {
    const count = await db
      .prepare("SELECT COUNT(*) as count FROM content_items WHERE kind = ?")
      .bind("certification")
      .first<{ count: number }>();
    if ((count?.count ?? 0) > 0) {
      return jsonResponse(
        { error: "Certifications already exist in D1. Import runs only once on an empty table." },
        409,
      );
    }
    const now = Date.now();
    for (const seed of SEED_CERTIFICATIONS) {
      await db
        .prepare(
          "INSERT INTO content_items (kind, title, subtitle, description, url, image, tags, sort_order, is_visible, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(
          seed.kind,
          seed.title,
          seed.subtitle,
          seed.description,
          seed.url,
          seed.image,
          JSON.stringify(seed.tags),
          seed.sort_order,
          1,
          now,
          now,
        )
        .run();
    }
    return jsonResponse({ ok: true, imported: SEED_CERTIFICATIONS.length }, 201);
  } catch (error) {
    console.error("Seed import failed", error);
    return jsonResponse({ error: "Failed to import seeds." }, 500);
  }
}

// TEMPORARY login diagnostic — REMOVE after debugging (see _diag route).
// Exposes only: a PBKDF2 of a fixed public input (reveals runtime crypto
// behavior, zero credential material) and the first 8 hex chars of the
// stored admin hash (32-bit hint, useless for offline cracking).
async function handleAdminDiag(env: unknown): Promise<Response> {
  const { hash } = await hashPassword("diag-vector-password", "00112233445566778899aabbccddeeff");
  let rowPrefix: string | null = null;
  const db = getDb(env);
  if (db) {
    try {
      const row = await db
        .prepare("SELECT password_hash FROM admin_users WHERE username = ?")
        .bind("divyansh")
        .first<{ password_hash: string }>();
      if (row && typeof row.password_hash === "string") {
        rowPrefix = row.password_hash.slice(0, 8);
      }
    } catch (error) {
      console.error("Diag row lookup failed", error);
    }
  }
  return jsonResponse({ vector_hash: hash, row_prefix: rowPrefix, db: Boolean(db) });
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
  return jsonResponse({ ok: true });
}

async function handleAdminRequest(request: Request, env: unknown): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname;

  if (path === "/api/admin/status" && request.method === "GET") {
    const db = getDb(env);
    return jsonResponse({ db: Boolean(db), hasAdmin: await hasAnyAdmin(env) });
  }
  if (path === "/api/admin/login" && request.method === "POST") {
    return handleAdminLogin(request, env);
  }
  if (path === "/api/admin/logout" && request.method === "POST") {
    await destroySession(request, env);
    return jsonResponse({ ok: true }, 200, {
      "set-cookie": buildClearedSessionCookie(isSecureRequest(request)),
    });
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
  // TEMPORARY login diagnostic — REMOVE after debugging.
  if (path === "/api/admin/_diag" && request.method === "GET") {
    return handleAdminDiag(env);
  }
  if (path === "/api/admin/password" && (request.method === "PUT" || request.method === "POST")) {
    return handleAdminPassword(request, env);
  }
  const itemMatch = path.match(/^\/api\/admin\/items\/([^/]+)$/);
  if (itemMatch && (request.method === "PUT" || request.method === "DELETE")) {
    return handleAdminItemById(request, env, decodeURIComponent(itemMatch[1]!));
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
    headers: { "content-type": "text/html; charset=utf-8" },
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
      return await normalizeCatastrophicSsrResponse(response);
    } catch (error) {
      console.error(error);
      return brandedErrorResponse();
    }
  },
};
