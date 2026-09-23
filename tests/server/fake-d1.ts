import { hashPassword, sha256Hex } from "@/lib/admin-auth";
import server from "@/server";

/* Minimal in-memory D1 stand-in implementing just the surface server.ts uses. */

export type Row = Record<string, unknown>;

export class FakeStatement {
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

export class FakeD1 {
  users: Row[] = [];
  sessions: Row[] = [];
  items: Row[] = [];
  settings: Row[] = [];
  grants: Row[] = [];
  otps: Row[] = [];
  seq = 1;
  useq = 1;
  oseq = 1;

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
    if (sql.includes("FROM admin_grants WHERE token_hash")) {
      return (this.grants.find((s) => s.token_hash === p[0]) as Row) ?? null;
    }
    if (sql.includes("FROM admin_users WHERE id")) {
      return (this.users.find((u) => u.id === p[0]) as Row) ?? null;
    }
    if (sql.includes("COUNT(*) as count FROM content_items WHERE kind")) {
      return { count: this.items.filter((i) => i.kind === p[0]).length };
    }
    if (sql.includes("FROM admin_otps WHERE user_id")) {
      // Latest live OTP row for the user.
      const live = this.otps
        .filter(
          (o) =>
            o.user_id === p[0] &&
            Number(o.used) === 0 &&
            Number(o.expires_at) > Number(p[1] ?? Date.now()),
        )
        .sort((a, b) => Number(a.id) - Number(b.id));
      return (live[live.length - 1] as Row) ?? null;
    }
    return null;
  }

  handleAll(sql: string, p: unknown[]): Row[] {
    if (sql.includes("FROM site_settings")) {
      return [...this.settings];
    }
    if (sql.includes("FROM admin_otps WHERE user_id")) {
      // Throttle list: rows created within the window.
      return this.otps.filter((o) => o.user_id === p[0] && Number(o.created_at) > Number(p[1]));
    }
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
    if (sql.startsWith("DELETE FROM admin_grants WHERE token_hash")) {
      this.grants = this.grants.filter((s) => s.token_hash !== p[0]);
      return { success: true };
    }
    if (sql.startsWith("DELETE FROM admin_grants WHERE user_id")) {
      this.grants = this.grants.filter((s) => s.user_id !== p[0]);
      return { success: true };
    }
    if (sql.startsWith("DELETE FROM admin_grants WHERE expires_at")) {
      this.grants = this.grants.filter((s) => Number(s.expires_at) >= Number(p[0]));
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
        meta: p[7],
        sort_order: p[8],
        is_visible: p[9],
        created_at: p[10],
        updated_at: p[11],
      });
      return { success: true, meta: { last_row_id: id } };
    }
    if (sql.startsWith("UPDATE content_items SET kind")) {
      const row = this.items.find((i) => i.id === p[11]);
      if (row) {
        row.kind = p[0];
        row.title = p[1];
        row.subtitle = p[2];
        row.description = p[3];
        row.url = p[4];
        row.image = p[5];
        row.tags = p[6];
        row.meta = p[7];
        row.sort_order = p[8];
        row.is_visible = p[9];
        row.updated_at = p[10];
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
    if (sql.startsWith("INSERT INTO admin_otps")) {
      const id = this.oseq++;
      this.otps.push({
        id,
        user_id: p[0],
        code_hash: p[1],
        expires_at: p[2],
        attempts: 0,
        used: 0,
        created_at: p[3],
      });
      return { success: true, meta: { last_row_id: id } };
    }
    if (sql.startsWith("UPDATE admin_otps SET used = 1 WHERE user_id = ? AND used = 0")) {
      this.otps.forEach((o) => {
        if (o.user_id === p[0] && Number(o.used) === 0) o.used = 1;
      });
      return { success: true };
    }
    if (sql.startsWith("UPDATE admin_otps SET used = 1 WHERE user_id = ? AND code_hash")) {
      this.otps.forEach((o) => {
        if (o.user_id === p[0] && o.code_hash === p[1]) o.used = 1;
      });
      return { success: true };
    }
    if (sql.startsWith("UPDATE admin_otps SET used = 1 WHERE id")) {
      const row = this.otps.find((o) => o.id === p[0]);
      if (row) row.used = 1;
      return { success: true };
    }
    if (sql.startsWith("UPDATE admin_otps SET attempts = attempts + 1 WHERE id")) {
      const row = this.otps.find((o) => o.id === p[0]);
      if (row) row.attempts = Number(row.attempts) + 1;
      return { success: true };
    }
    if (sql.startsWith("DELETE FROM admin_otps WHERE user_id = ? AND (used = 1 OR expires_at")) {
      const now = Number(p[1]);
      this.otps = this.otps.filter(
        (o) => !(o.user_id === p[0] && (Number(o.used) === 1 || Number(o.expires_at) < now)),
      );
      return { success: true };
    }
    if (sql.startsWith("DELETE FROM admin_otps WHERE user_id")) {
      this.otps = this.otps.filter((o) => o.user_id !== p[0]);
      return { success: true };
    }
    if (sql.startsWith("INSERT INTO admin_grants")) {
      this.grants.push({ token_hash: p[0], user_id: p[1], expires_at: p[2], created_at: p[3] });
      return { success: true };
    }
    if (sql.startsWith("INSERT INTO site_settings")) {
      const existing = this.settings.find((s) => s.key === p[0]);
      if (existing) {
        existing.value = p[1];
        existing.updated_at = p[2];
      } else {
        this.settings.push({ key: p[0], value: p[1], updated_at: p[2] });
      }
      return { success: true };
    }
    if (sql.startsWith("DELETE FROM site_settings WHERE key")) {
      this.settings = this.settings.filter((s) => s.key !== p[0]);
      return { success: true };
    }
    throw new Error("Unhandled SQL in fake: " + sql);
  }
}

export function req(path: string, init?: RequestInit, ip = "10.0.0.1"): Request {
  return new Request(`http://localhost${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      "cf-connecting-ip": ip,
      ...(init?.headers ?? {}),
    },
  });
}

export async function seedAdmin(db: FakeD1, username: string, password: string) {
  const { hash, salt } = await hashPassword(password);
  const id = db.useq++;
  db.users.push({ id, username, password_hash: hash, salt, created_at: Date.now() });
  return { id, username, password };
}

export async function login(db: FakeD1, username: string, password: string, ip = "10.0.0.1") {
  return server.fetch(
    req("/api/admin/login", { method: "POST", body: JSON.stringify({ username, password }) }, ip),
    { DB: db },
    {},
  );
}

export function cookieFrom(res: Response): string {
  const setCookie = res.headers.get("set-cookie") ?? "";
  return setCookie.split(";")[0] ?? "";
}

/** Mint a verified step-up grant directly (mirrors a successful OTP verify). */
export async function grantCookieFor(db: FakeD1, userId = 1): Promise<string> {
  const token = "f".repeat(64);
  const tokenHash = await sha256Hex(token);
  db.grants.push({
    token_hash: tokenHash,
    user_id: userId,
    expires_at: Date.now() + 10 * 60 * 1000,
    created_at: Date.now(),
  });
  return `admin_otp=${token}`;
}

/** Session + grant cookies combined, as a browser would send them. */
export async function authedCookies(
  db: FakeD1,
  sessionCookie: string,
  userId = 1,
): Promise<string> {
  return `${sessionCookie}; ${await grantCookieFor(db, userId)}`;
}

export async function apiImportSeed(
  db: FakeD1,
  auth: { cookie: string },
  ip: string,
  kind: string,
  expectedStatus = 201,
) {
  const res = await server.fetch(
    req(
      "/api/admin/seed-import",
      { method: "POST", body: JSON.stringify({ kind }), headers: auth },
      ip,
    ),
    { DB: db },
    {},
  );
  expect(res.status).toBe(expectedStatus);
  return res;
}
