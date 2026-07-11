import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";
import { site } from "./lib/site";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

type ContactPayload = {
  name: string;
  email: string;
  message: string;
  company?: string;
};

type WorkerEnv = {
  RESEND_API_KEY?: string;
  RESEND_FROM_EMAIL?: string;
  CONTACT_TO_EMAIL?: string;
  CONTACT_RATE_LIMIT_MAX?: string;
  CONTACT_RATE_LIMIT_WINDOW_MS?: string;
};

const CONTACT_API_PATH = "/api/contact";
const ROBOTS_PATH = "/robots.txt";
const SITEMAP_PATH = "/sitemap.xml";
const DEFAULT_TO_EMAIL = "divyanshakya.dev@gmail.com";
const DEFAULT_FROM_EMAIL = "onboarding@resend.dev";
const DEFAULT_RATE_LIMIT_MAX = 5;
const DEFAULT_RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;

let serverEntryPromise: Promise<ServerEntry> | undefined;
const contactRateLimitStore = new Map<string, number[]>();

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
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
  if (typeof fromWorker === "string" && fromWorker.trim()) {
    return fromWorker.trim();
  }

  if (typeof process !== "undefined") {
    const fromProcess = process.env[key];
    if (typeof fromProcess === "string" && fromProcess.trim()) {
      return fromProcess.trim();
    }
  }

  return undefined;
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

function isRateLimited(request: Request, workerEnv: WorkerEnv): boolean {
  const ip = getClientIp(request);
  const now = Date.now();
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

  const existing = contactRateLimitStore.get(ip) ?? [];
  const recent = existing.filter((timestamp) => now - timestamp < windowMs);

  if (recent.length >= maxRequests) {
    contactRateLimitStore.set(ip, recent);
    return true;
  }

  recent.push(now);
  contactRateLimitStore.set(ip, recent);
  return false;
}

function parseContactPayload(payload: unknown): ContactPayload | null {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return null;
  }

  const data = payload as Record<string, unknown>;
  const name = typeof data.name === "string" ? data.name.trim() : "";
  const email = typeof data.email === "string" ? data.email.trim() : "";
  const message = typeof data.message === "string" ? data.message.trim() : "";

  if (!name || !email || !message || !isValidEmail(email)) {
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

  if (payload.company) {
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

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
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

      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      return await normalizeCatastrophicSsrResponse(response);
    } catch (error) {
      console.error(error);
      return brandedErrorResponse();
    }
  },
};
