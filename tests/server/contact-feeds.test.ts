import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import server from "@/server";
import { FakeD1, authedCookies, cookieFrom, login, req, seedAdmin } from "./fake-d1";

beforeEach(() => {
  delete process.env.RESEND_API_KEY;
  delete process.env.TURNSTILE_SECRET_KEY;
});

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.RESEND_API_KEY;
  delete process.env.TURNSTILE_SECRET_KEY;
});

function stubFetch(handler: (url: unknown, init?: RequestInit) => unknown) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: unknown, init?: RequestInit) => handler(url, init)),
  );
}

async function authed(db: FakeD1, ip: string) {
  await seedAdmin(db, "divyansh", "correct-horse-battery-99");
  const cookie = cookieFrom(await login(db, "divyansh", "correct-horse-battery-99", ip));
  return { cookie: await authedCookies(db, cookie) };
}

const contactPayload = {
  name: "Ada",
  email: "ada@example.com",
  message: "Hello from the audit!",
};

describe("contact persistence + inbox", () => {
  it("stores the message and reports emailed:false without a mail key", async () => {
    const db = new FakeD1();
    const res = await server.fetch(
      req("/api/contact", { method: "POST", body: JSON.stringify(contactPayload) }, "10.1.0.1"),
      { DB: db },
      {},
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, emailed: false });

    const auth = await authed(db, "10.1.0.2");
    const inbox = await server.fetch(
      req("/api/admin/messages", { headers: auth }, "10.1.0.2"),
      { DB: db },
      {},
    );
    expect(inbox.status).toBe(200);
    const data = (await inbox.json()) as { items: { name: string; email: string }[] };
    expect(data.items).toHaveLength(1);
    expect(data.items[0]).toMatchObject({ name: "Ada", email: "ada@example.com" });
  });

  it("emails when Resend is configured and still stores", async () => {
    process.env.RESEND_API_KEY = "re_test";
    stubFetch((url) => {
      if (String(url).includes("api.resend.com")) {
        return { ok: true, status: 200, text: async () => "" };
      }
      throw new Error("unexpected fetch " + String(url));
    });
    const db = new FakeD1();
    const res = await server.fetch(
      req("/api/contact", { method: "POST", body: JSON.stringify(contactPayload) }, "10.1.0.3"),
      { DB: db },
      {},
    );
    expect(await res.json()).toEqual({ ok: true, emailed: true });

    const auth = await authed(db, "10.1.0.4");
    const inbox = await server.fetch(
      req("/api/admin/messages", { headers: auth }, "10.1.0.4"),
      { DB: db },
      {},
    );
    expect(((await inbox.json()) as { items: unknown[] }).items).toHaveLength(1);
  });

  it("rejects unauthenticated inbox reads and enforces grants on delete", async () => {
    const db = new FakeD1();
    await server.fetch(
      req("/api/contact", { method: "POST", body: JSON.stringify(contactPayload) }, "10.1.0.5"),
      { DB: db },
      {},
    );
    const anon = await server.fetch(req("/api/admin/messages"), { DB: db }, {});
    expect(anon.status).toBe(401);

    await seedAdmin(db, "divyansh", "correct-horse-battery-99");
    const sessionOnly = cookieFrom(
      await login(db, "divyansh", "correct-horse-battery-99", "10.1.0.6"),
    );
    const denied = await server.fetch(
      req(
        "/api/admin/messages/1",
        { method: "DELETE", headers: { cookie: sessionOnly } },
        "10.1.0.6",
      ),
      { DB: db },
      {},
    );
    expect(denied.status).toBe(403);

    const auth = { cookie: await authedCookies(db, sessionOnly) };
    const del = await server.fetch(
      req("/api/admin/messages/1", { method: "DELETE", headers: auth }, "10.1.0.7"),
      { DB: db },
      {},
    );
    expect(del.status).toBe(200);
    const inbox = await server.fetch(
      req("/api/admin/messages", { headers: auth }, "10.1.0.7"),
      { DB: db },
      {},
    );
    expect(((await inbox.json()) as { items: unknown[] }).items).toEqual([]);
  });
});

describe("turnstile gate", () => {
  it("is skipped when no secret is configured", async () => {
    const res = await server.fetch(
      req("/api/contact", { method: "POST", body: JSON.stringify(contactPayload) }, "10.1.1.1"),
      {},
      {},
    );
    expect(res.status).toBe(200);
  });

  it("requires and verifies the token when configured", async () => {
    process.env.TURNSTILE_SECRET_KEY = "ts_test";
    const missing = await server.fetch(
      req("/api/contact", { method: "POST", body: JSON.stringify(contactPayload) }, "10.1.1.2"),
      {},
      {},
    );
    expect(missing.status).toBe(400);

    stubFetch((url) => {
      if (String(url).includes("siteverify")) {
        return { ok: true, json: async () => ({ success: false }) };
      }
      throw new Error("unexpected fetch " + String(url));
    });
    const bad = await server.fetch(
      req(
        "/api/contact",
        {
          method: "POST",
          body: JSON.stringify({ ...contactPayload, "cf-turnstile-response": "tok" }),
        },
        "10.1.1.3",
      ),
      {},
      {},
    );
    expect(bad.status).toBe(403);

    stubFetch((url) => {
      if (String(url).includes("siteverify")) {
        return { ok: true, json: async () => ({ success: true }) };
      }
      throw new Error("unexpected fetch " + String(url));
    });
    const good = await server.fetch(
      req(
        "/api/contact",
        {
          method: "POST",
          body: JSON.stringify({ ...contactPayload, "cf-turnstile-response": "tok" }),
        },
        "10.1.1.4",
      ),
      {},
      {},
    );
    expect(good.status).toBe(200);
  });
});

describe("rss + status", () => {
  it("serves an RSS feed with published writing", async () => {
    const db = new FakeD1();
    const auth = await authed(db, "10.1.2.1");
    const created = await server.fetch(
      req(
        "/api/admin/items",
        {
          method: "POST",
          headers: auth,
          body: JSON.stringify({ kind: "blog", title: "Hello RSS", description: "first post" }),
        },
        "10.1.2.1",
      ),
      { DB: db },
      {},
    );
    expect(created.status).toBe(201);

    const rss = await server.fetch(req("/rss.xml"), { DB: db }, {});
    expect(rss.status).toBe(200);
    expect(rss.headers.get("content-type")).toContain("application/rss+xml");
    const body = await rss.text();
    expect(body).toContain('<rss version="2.0">');
    expect(body).toContain("Hello RSS");
  });

  it("hides future-scheduled items from public content but not the feed shape", async () => {
    const db = new FakeD1();
    const auth = await authed(db, "10.1.2.2");
    const future = Date.now() + 30 * 24 * 3600 * 1000;
    await server.fetch(
      req(
        "/api/admin/items",
        {
          method: "POST",
          headers: auth,
          body: JSON.stringify({
            kind: "blog",
            title: "Future post",
            meta: { publish_at: future },
          }),
        },
        "10.1.2.2",
      ),
      { DB: db },
      {},
    );
    const pub = await server.fetch(req("/api/content?kind=blog"), { DB: db }, {});
    expect(((await pub.json()) as { items: unknown[] }).items).toEqual([]);

    const admin = await server.fetch(
      req("/api/admin/items?kind=blog", { headers: auth }, "10.1.2.2"),
      { DB: db },
      {},
    );
    expect(((await admin.json()) as { items: unknown[] }).items).toHaveLength(1);
  });

  it("reports public status with per-kind counts", async () => {
    const db = new FakeD1();
    const res = await server.fetch(req("/api/status"), { DB: db }, {});
    expect(res.status).toBe(200);
    const data = (await res.json()) as {
      ok: boolean;
      db: boolean;
      metaReady: boolean;
      counts: Record<string, number>;
    };
    expect(data.ok).toBe(true);
    expect(data.db).toBe(true);
    expect(data.metaReady).toBe(true);
    expect(data.counts).toEqual({});
  });
});
