import { describe, expect, it, beforeEach } from "vitest";
import { hashPassword } from "@/lib/admin-auth";
import server from "@/server";

/* Minimal in-memory D1 stand-in implementing just the surface server.ts uses. */

type Row = Record<string, unknown>;

class FakeStatement {
  constructor(
    private db: FakeD1,
    private sql: string,
    private params: unknown[] = [],
  ) {}
  bind(...params: unknown[]) {
    return new FakeStatement(this.db, this.sql, params);
  }
  async first<T = Row>(): Promise<T | null> {
    return this.db.handleFirst(this.sql, this.params) as T | null;
  }
  async all<T = Row>(): Promise<{ results: T[]; success: boolean }> {
    return { results: this.db.handleAll(this.sql, this.params) as T[], success: true };
  }
  async run(): Promise<{ success: boolean; meta?: { last_row_id?: number } }> {
    return this.db.handleRun(this.sql, this.params);
  }
}

class FakeD1 {
  users: Row[] = [];
  sessions: Row[] = [];
  items: Row[] = [];
  seq = 1;
  useq = 1;

  prepare(sql: string) {
    return new FakeStatement(this, sql);
  }
  async batch(stmts: FakeStatement[]) {
    for (const s of stmts) await s.run();
    return [];
  }

  handleFirst(sql: string, p: unknown[]): Row | null {
    if (sql.includes("FROM admin_users WHERE username")) {
      return (this.users.find((u) => u.username === p[0]) as Row) ?? null;
    }
    if (sql.includes("COUNT(*) as count FROM admin_users")) {
      return { count: this.users.length };
    }
    if (sql.includes("FROM admin_sessions WHERE token_hash")) {
      return (this.sessions.find((s) => s.token_hash === p[0]) as Row) ?? null;
    }
    if (sql.includes("FROM admin_users WHERE id")) {
      return (this.users.find((u) => u.id === p[0]) as Row) ?? null;
    }
    if (sql.includes("COUNT(*) as count FROM content_items WHERE kind")) {
      return { count: this.items.filter((i) => i.kind === p[0]).length };
    }
    return null;
  }

  handleAll(sql: string, p: unknown[]): Row[] {
    const visible = sql.includes("is_visible = 1");
    const byKind = sql.includes("WHERE kind = ?");
    let rows = [...this.items];
    if (byKind) rows = rows.filter((i) => i.kind === p[0]);
    if (visible) rows = rows.filter((i) => Number(i.is_visible) === 1);
    rows.sort((a, b) => Number(a.sort_order) - Number(b.sort_order) || Number(a.id) - Number(b.id));
    return rows;
  }

  handleRun(sql: string, p: unknown[]): { success: boolean; meta?: { last_row_id?: number } } {
    if (sql.startsWith("INSERT INTO admin_sessions")) {
      this.sessions.push({ token_hash: p[0], user_id: p[1], expires_at: p[2], created_at: p[3] });
      return { success: true };
    }
    if (sql.startsWith("DELETE FROM admin_sessions WHERE token_hash")) {
      this.sessions = this.sessions.filter((s) => s.token_hash !== p[0]);
      return { success: true };
    }
    if (sql.startsWith("DELETE FROM admin_sessions WHERE expires_at")) {
      this.sessions = this.sessions.filter((s) => Number(s.expires_at) >= Number(p[0]));
      return { success: true };
    }
    if (sql.startsWith("DELETE FROM admin_sessions WHERE user_id")) {
      this.sessions = this.sessions.filter((s) => !(s.user_id === p[0] && s.token_hash !== p[1]));
      return { success: true };
    }
    if (sql.startsWith("UPDATE admin_users SET password_hash")) {
      const u = this.users.find((x) => x.id === p[2]);
      if (u) {
        u.password_hash = p[0];
        u.salt = p[1];
      }
      return { success: true };
    }
    if (sql.startsWith("INSERT INTO content_items")) {
      const id = this.seq++;
      this.items.push({
        id,
        kind: p[0],
        title: p[1],
        subtitle: p[2],
        description: p[3],
        url: p[4],
        image: p[5],
        tags: p[6],
        sort_order: p[7],
        is_visible: p[8],
        created_at: p[9],
        updated_at: p[10],
      });
      return { success: true, meta: { last_row_id: id } };
    }
    if (sql.startsWith("UPDATE content_items SET kind")) {
      const row = this.items.find((i) => i.id === p[10]);
      if (row) {
        row.kind = p[0];
        row.title = p[1];
        row.subtitle = p[2];
        row.description = p[3];
        row.url = p[4];
        row.image = p[5];
        row.tags = p[6];
        row.sort_order = p[7];
        row.is_visible = p[8];
        row.updated_at = p[9];
      }
      return { success: true };
    }
    if (sql.startsWith("UPDATE content_items SET sort_order")) {
      const row = this.items.find((i) => i.id === p[2] && i.kind === p[3]);
      if (row) {
        row.sort_order = p[0];
        row.updated_at = p[1];
      }
      return { success: true };
    }
    if (sql.startsWith("DELETE FROM content_items WHERE id")) {
      this.items = this.items.filter((i) => i.id !== p[0]);
      return { success: true };
    }
    throw new Error("Unhandled SQL in fake: " + sql);
  }
}

function req(path: string, init?: RequestInit, ip = "10.0.0.1"): Request {
  return new Request(`http://localhost${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      "cf-connecting-ip": ip,
      ...(init?.headers ?? {}),
    },
  });
}

async function seedAdmin(db: FakeD1, username: string, password: string) {
  const { hash, salt } = await hashPassword(password);
  const id = db.useq++;
  db.users.push({ id, username, password_hash: hash, salt, created_at: Date.now() });
  return { id, username, password };
}

async function login(db: FakeD1, username: string, password: string, ip = "10.0.0.1") {
  return server.fetch(
    req("/api/admin/login", { method: "POST", body: JSON.stringify({ username, password }) }, ip),
    { DB: db },
    {},
  );
}

function cookieFrom(res: Response): string {
  const setCookie = res.headers.get("set-cookie") ?? "";
  return setCookie.split(";")[0] ?? "";
}

beforeEach(() => {
  delete process.env.ADMIN_USERNAME;
  delete process.env.ADMIN_PASSWORD_HASH;
  delete process.env.ADMIN_PASSWORD_SALT;
});

describe("admin API without DB (local fallback)", () => {
  it("reports status and serves seed certifications", async () => {
    const status = await server.fetch(req("/api/admin/status"), {}, {});
    expect(await status.json()).toEqual({ db: false, hasAdmin: false });

    const res = await server.fetch(req("/api/content?kind=certification"), {}, {});
    const data = (await res.json()) as { items: { title: string; url: string }[] };
    expect(data.items).toHaveLength(2);
    expect(data.items[0]?.url).toContain("tryhackme.com");
  });

  it("keeps research/blogs empty and rejects bad kinds", async () => {
    const res = await server.fetch(req("/api/content?kind=research"), {}, {});
    expect(((await res.json()) as { items: unknown[] }).items).toEqual([]);
    const bad = await server.fetch(req("/api/content?kind=nope"), {}, {});
    expect(bad.status).toBe(400);
  });

  it("rejects login with generic error when no admin exists", async () => {
    const res = await login({} as never, "divyansh", "long-enough-password-123", "10.0.0.11");
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "Invalid username or password." });
  });
});

describe("admin API with D1", () => {
  it("full auth lifecycle: login, me, logout, bad password, unknown user, origin", async () => {
    const db = new FakeD1();
    await seedAdmin(db, "divyansh", "correct-horse-battery-99");

    const ok = await login(db, "divyansh", "correct-horse-battery-99", "10.0.1.1");
    expect(ok.status).toBe(200);
    const setCookie = ok.headers.get("set-cookie") ?? "";
    expect(setCookie).toContain("admin_session=");
    expect(setCookie).toContain("HttpOnly");
    expect(setCookie).toContain("SameSite=Lax");
    const cookie = cookieFrom(ok);

    const me = await server.fetch(
      req("/api/admin/me", { headers: { cookie } }, "10.0.1.1"),
      { DB: db },
      {},
    );
    expect(me.status).toBe(200);
    expect(await me.json()).toEqual({ user: { id: 1, username: "divyansh" } });

    const wrong = await login(db, "divyansh", "wrong-password-long-enough", "10.0.1.2");
    expect(wrong.status).toBe(401);
    expect(await wrong.json()).toEqual({ error: "Invalid username or password." });

    const unknown = await login(db, "nosuchuser", "some-long-password-123", "10.0.1.3");
    expect(unknown.status).toBe(401);

    const cross = await server.fetch(
      req(
        "/api/admin/login",
        {
          method: "POST",
          body: JSON.stringify({ username: "divyansh", password: "x" }),
          headers: { origin: "https://evil.com" },
        },
        "10.0.1.4",
      ),
      { DB: db },
      {},
    );
    expect(cross.status).toBe(403);

    const out = await server.fetch(
      req("/api/admin/logout", { method: "POST", headers: { cookie } }, "10.0.1.1"),
      { DB: db },
      {},
    );
    expect(out.status).toBe(200);
    const meAfter = await server.fetch(
      req("/api/admin/me", { headers: { cookie } }, "10.0.1.1"),
      { DB: db },
      {},
    );
    expect(meAfter.status).toBe(401);
  });

  it("rate-limits login after 5 attempts", async () => {
    const db = new FakeD1();
    await seedAdmin(db, "divyansh", "correct-horse-battery-99");
    for (let i = 0; i < 5; i++) {
      const r = await login(db, "divyansh", "wrong-password-long-enough", "10.0.9.9");
      expect(r.status).toBe(401);
    }
    const limited = await login(db, "divyansh", "wrong-password-long-enough", "10.0.9.9");
    expect(limited.status).toBe(429);
  });

  it("CRUD + reorder + visibility toggle require auth", async () => {
    const db = new FakeD1();
    await seedAdmin(db, "divyansh", "correct-horse-battery-99");
    const cookie = cookieFrom(await login(db, "divyansh", "correct-horse-battery-99", "10.0.2.1"));
    const auth = { cookie };

    const anon = await server.fetch(req("/api/admin/items?kind=all"), { DB: db }, {});
    expect(anon.status).toBe(401);

    const payload = {
      kind: "blog",
      title: "First post",
      subtitle: "Notes",
      description: "Body",
      url: "https://example.com/a",
      tags: ["a", "b"],
      sort_order: 1,
      is_visible: true,
    };
    const created = await server.fetch(
      req(
        "/api/admin/items",
        { method: "POST", body: JSON.stringify(payload), headers: auth },
        "10.0.2.1",
      ),
      { DB: db },
      {},
    );
    expect(created.status).toBe(201);
    const { id } = (await created.json()) as { id: number };

    const listed = (await (
      await server.fetch(
        req("/api/admin/items?kind=blog", { headers: auth }, "10.0.2.1"),
        { DB: db },
        {},
      )
    ).json()) as { items: { id: number; title: string }[] };
    expect(listed.items.map((i) => i.title)).toContain("First post");

    const updated = await server.fetch(
      req(
        `/api/admin/items/${id}`,
        {
          method: "PUT",
          body: JSON.stringify({ ...payload, title: "Renamed", is_visible: false }),
          headers: auth,
        },
        "10.0.2.1",
      ),
      { DB: db },
      {},
    );
    expect(updated.status).toBe(200);

    // Hidden -> public API stays empty (admin hiding is respected).
    const pub = (await (await server.fetch(req("/api/content?kind=blog"), {}, {})).json()) as {
      items: unknown[];
    };
    expect(pub.items).toEqual([]);

    const second = (await (
      await server.fetch(
        req(
          "/api/admin/items",
          { method: "POST", body: JSON.stringify({ ...payload, title: "Second" }), headers: auth },
          "10.0.2.1",
        ),
        { DB: db },
        {},
      )
    ).json()) as { id: number };

    const reorder = await server.fetch(
      req(
        "/api/admin/reorder",
        {
          method: "POST",
          body: JSON.stringify({ kind: "blog", ids: [second.id, id] }),
          headers: auth,
        },
        "10.0.2.1",
      ),
      { DB: db },
      {},
    );
    expect(reorder.status).toBe(200);

    const del = await server.fetch(
      req(`/api/admin/items/${id}`, { method: "DELETE", headers: auth }, "10.0.2.1"),
      { DB: db },
      {},
    );
    expect(del.status).toBe(200);
  });

  it("seed fallback, seed import, and admin-hide semantics", async () => {
    const db = new FakeD1();
    await seedAdmin(db, "divyansh", "correct-horse-battery-99");
    const cookie = cookieFrom(await login(db, "divyansh", "correct-horse-battery-99", "10.0.3.1"));
    const auth = { cookie };

    // Fresh D1: public falls back to the 2 real seeds.
    const before = (await (
      await server.fetch(req("/api/content?kind=certification"), { DB: db }, {})
    ).json()) as {
      items: { title: string }[];
    };
    expect(before.items).toHaveLength(2);

    const imported = await server.fetch(
      req(
        "/api/admin/seed-import",
        { method: "POST", body: JSON.stringify({ kind: "certification" }), headers: auth },
        "10.0.3.1",
      ),
      { DB: db },
      {},
    );
    expect(imported.status).toBe(201);

    const after = (await (
      await server.fetch(req("/api/content?kind=certification"), { DB: db }, {})
    ).json()) as {
      items: { id: number; title: string }[];
    };
    expect(after.items).toHaveLength(2);
    expect(typeof after.items[0]?.id).toBe("number");

    const again = await server.fetch(
      req(
        "/api/admin/seed-import",
        { method: "POST", body: JSON.stringify({}), headers: auth },
        "10.0.3.1",
      ),
      { DB: db },
      {},
    );
    expect(again.status).toBe(409);

    // Admin hides everything -> public respects it (no seed resurrection).
    for (const item of after.items) {
      await server.fetch(
        req(
          `/api/admin/items/${item.id}`,
          {
            method: "PUT",
            body: JSON.stringify({ kind: "certification", title: item.title, is_visible: false }),
            headers: auth,
          },
          "10.0.3.1",
        ),
        { DB: db },
        {},
      );
    }
    const hidden = (await (
      await server.fetch(req("/api/content?kind=certification"), { DB: db }, {})
    ).json()) as {
      items: unknown[];
    };
    expect(hidden.items).toEqual([]);
  });

  it("password change validates, verifies current, and kills other sessions", async () => {
    const db = new FakeD1();
    await seedAdmin(db, "divyansh", "correct-horse-battery-99");
    const c1 = cookieFrom(await login(db, "divyansh", "correct-horse-battery-99", "10.0.4.1"));
    const c2 = cookieFrom(await login(db, "divyansh", "correct-horse-battery-99", "10.0.4.2"));

    const weak = await server.fetch(
      req(
        "/api/admin/password",
        {
          method: "PUT",
          body: JSON.stringify({
            currentPassword: "correct-horse-battery-99",
            newPassword: "short",
          }),
          headers: { cookie: c1 },
        },
        "10.0.4.1",
      ),
      { DB: db },
      {},
    );
    expect(weak.status).toBe(400);

    const wrongCurrent = await server.fetch(
      req(
        "/api/admin/password",
        {
          method: "PUT",
          body: JSON.stringify({
            currentPassword: "nope-nope-nope-nope",
            newPassword: "new-long-password-456",
          }),
          headers: { cookie: c1 },
        },
        "10.0.4.1",
      ),
      { DB: db },
      {},
    );
    expect(wrongCurrent.status).toBe(401);

    const changed = await server.fetch(
      req(
        "/api/admin/password",
        {
          method: "PUT",
          body: JSON.stringify({
            currentPassword: "correct-horse-battery-99",
            newPassword: "new-long-password-456",
          }),
          headers: { cookie: c1 },
        },
        "10.0.4.1",
      ),
      { DB: db },
      {},
    );
    expect(changed.status).toBe(200);

    // Keeper session still works, other session is dead, old password fails.
    expect(
      (
        await server.fetch(
          req("/api/admin/me", { headers: { cookie: c1 } }, "10.0.4.1"),
          { DB: db },
          {},
        )
      ).status,
    ).toBe(200);
    expect(
      (
        await server.fetch(
          req("/api/admin/me", { headers: { cookie: c2 } }, "10.0.4.2"),
          { DB: db },
          {},
        )
      ).status,
    ).toBe(401);
    expect((await login(db, "divyansh", "correct-horse-battery-99", "10.0.4.3")).status).toBe(401);
    expect((await login(db, "divyansh", "new-long-password-456", "10.0.4.4")).status).toBe(200);
  });

  it("rejects invalid item payloads and seed-id edits", async () => {
    const db = new FakeD1();
    await seedAdmin(db, "divyansh", "correct-horse-battery-99");
    const cookie = cookieFrom(await login(db, "divyansh", "correct-horse-battery-99", "10.0.5.1"));
    const auth = { cookie };

    const badKind = await server.fetch(
      req(
        "/api/admin/items",
        { method: "POST", body: JSON.stringify({ kind: "x", title: "t" }), headers: auth },
        "10.0.5.1",
      ),
      { DB: db },
      {},
    );
    expect(badKind.status).toBe(400);

    const seedEdit = await server.fetch(
      req("/api/admin/items/seed-thm-sec1", { method: "DELETE", headers: auth }, "10.0.5.1"),
      { DB: db },
      {},
    );
    expect(seedEdit.status).toBe(400);

    const badReorder = await server.fetch(
      req(
        "/api/admin/reorder",
        { method: "POST", body: JSON.stringify({ kind: "blog", ids: ["x"] }), headers: auth },
        "10.0.5.1",
      ),
      { DB: db },
      {},
    );
    expect(badReorder.status).toBe(400);
  });
});
