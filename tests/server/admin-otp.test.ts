import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";

vi.mock("@/lib/admin-auth", async (importOriginal) => ({
  ...((await importOriginal()) as object),
  // Deterministic code for tests; everything else stays original.
  newOtpCode: () => "123456",
}));

import { hashPassword } from "@/lib/admin-auth";
import server from "@/server";
import { FakeD1, req, seedAdmin, login, cookieFrom } from "./fake-d1";

beforeEach(() => {
  delete process.env.ADMIN_USERNAME;
  delete process.env.ADMIN_PASSWORD_HASH;
  delete process.env.ADMIN_PASSWORD_SALT;
  delete process.env.ADMIN_EMAIL;
  delete process.env.RESEND_API_KEY;
});

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.ADMIN_EMAIL;
  delete process.env.RESEND_API_KEY;
});

function stubResend(ok = true) {
  const fn = vi.fn(async (url: unknown) => {
    if (String(url).includes("api.resend.com")) {
      return { ok, status: ok ? 200 : 500, text: async () => (ok ? "" : "boom") };
    }
    throw new Error("unexpected fetch " + String(url));
  });
  vi.stubGlobal("fetch", fn);
  return fn;
}

async function authed(db: FakeD1, ip: string) {
  await seedAdmin(db, "divyansh", "correct-horse-battery-99");
  const cookie = cookieFrom(await login(db, "divyansh", "correct-horse-battery-99", ip));
  return { cookie };
}

describe("step-up OTP via Resend email", () => {
  it("request requires email config, then sends a 6-digit code to ADMIN_EMAIL", async () => {
    const db = new FakeD1();
    const { cookie } = await authed(db, "10.1.0.1");

    const noMail = await server.fetch(
      req("/api/admin/otp/request", { method: "POST", headers: { cookie } }, "10.1.0.1"),
      { DB: db },
      {},
    );
    expect(noMail.status).toBe(501);

    process.env.RESEND_API_KEY = "re_test";
    process.env.ADMIN_EMAIL = "not-an-email";
    const badEmail = await server.fetch(
      req("/api/admin/otp/request", { method: "POST", headers: { cookie } }, "10.1.0.1"),
      { DB: db },
      {},
    );
    expect(badEmail.status).toBe(501);

    process.env.ADMIN_EMAIL = "owner@example.com";
    const sent = stubResend(true);
    const res = await server.fetch(
      req("/api/admin/otp/request", { method: "POST", headers: { cookie } }, "10.1.0.1"),
      { DB: db },
      {},
    );
    expect(res.status).toBe(200);
    expect(sent).toHaveBeenCalledOnce();
    const [, init] = sent.mock.calls[0] as unknown as [string, { body: string }];
    const body = JSON.parse(init.body) as { to: string[]; subject: string; text: string };
    expect(body.to).toEqual(["owner@example.com"]);
    const match = body.text.match(/(\d{6})/);
    expect(match?.[1]).toBe("123456");

    // Immediate re-request is throttled.
    const again = await server.fetch(
      req("/api/admin/otp/request", { method: "POST", headers: { cookie } }, "10.1.0.1"),
      { DB: db },
      {},
    );
    expect(again.status).toBe(429);
  });

  it("verify locks after 5 wrong attempts, accepts the right code once", async () => {
    const db = new FakeD1();
    const { cookie } = await authed(db, "10.1.0.2");
    process.env.RESEND_API_KEY = "re_test";
    stubResend(true);
    await server.fetch(
      req("/api/admin/otp/request", { method: "POST", headers: { cookie } }, "10.1.0.2"),
      { DB: db },
      {},
    );

    const attempt = (code: string, ip: string) =>
      server.fetch(
        req(
          "/api/admin/otp/verify",
          { method: "POST", body: JSON.stringify({ code }), headers: { cookie } },
          ip,
        ),
        { DB: db },
        {},
      );
    for (let i = 0; i < 5; i++) {
      expect((await attempt("000000", `10.1.1.${i}`)).status).toBe(401);
    }
    // 6th wrong attempt: locked, needs a fresh code.
    expect((await attempt("000000", "10.1.1.9")).status).toBe(403);
    // The locked row is consumed: even the right code now gets the generic
    // answer (no oracle distinguishing locked/consumed/missing).
    expect((await attempt("123456", "10.1.1.10")).status).toBe(401);
  });

  it("a verified grant unlocks mutations for 10 minutes", async () => {
    const db = new FakeD1();
    const { cookie } = await authed(db, "10.1.0.3");
    process.env.RESEND_API_KEY = "re_test";
    stubResend(true);
    await server.fetch(
      req("/api/admin/otp/request", { method: "POST", headers: { cookie } }, "10.1.0.3"),
      { DB: db },
      {},
    );

    const payload = { kind: "blog", title: "otp post" };
    const denied = await server.fetch(
      req(
        "/api/admin/items",
        { method: "POST", body: JSON.stringify(payload), headers: { cookie } },
        "10.1.0.3",
      ),
      { DB: db },
      {},
    );
    expect(denied.status).toBe(403);

    const verified = await server.fetch(
      req(
        "/api/admin/otp/verify",
        { method: "POST", body: JSON.stringify({ code: "123456" }), headers: { cookie } },
        "10.1.0.3",
      ),
      { DB: db },
      {},
    );
    expect(verified.status).toBe(200);
    const grantCookie = (verified.headers.get("set-cookie") ?? "").split(";")[0] ?? "";
    expect(grantCookie).toMatch(/^admin_otp=[0-9a-f]{64}$/);
    const both = `${cookie}; ${grantCookie}`;

    const created = await server.fetch(
      req(
        "/api/admin/items",
        { method: "POST", body: JSON.stringify(payload), headers: { cookie: both } },
        "10.1.0.3",
      ),
      { DB: db },
      {},
    );
    expect(created.status).toBe(201);

    const st = (await (
      await server.fetch(
        req("/api/admin/otp/status", { headers: { cookie: both } }, "10.1.0.3"),
        { DB: db },
        {},
      )
    ).json()) as { verified: boolean; stepUp: boolean };
    expect(st).toMatchObject({ verified: true, stepUp: true });

    // Revoke kills the grant but keeps the session.
    const revoked = await server.fetch(
      req("/api/admin/otp/revoke", { method: "POST", headers: { cookie: both } }, "10.1.0.3"),
      { DB: db },
      {},
    );
    expect(revoked.status).toBe(200);
    const afterRevoke = await server.fetch(
      req(
        "/api/admin/items",
        { method: "POST", body: JSON.stringify(payload), headers: { cookie: both } },
        "10.1.0.3",
      ),
      { DB: db },
      {},
    );
    expect(afterRevoke.status).toBe(403);
  });

  it("logout destroys the grant; fallback mode waives step-up", async () => {
    const db = new FakeD1();
    const { cookie } = await authed(db, "10.1.0.4");
    process.env.RESEND_API_KEY = "re_test";
    stubResend(true);
    await server.fetch(
      req("/api/admin/otp/request", { method: "POST", headers: { cookie } }, "10.1.0.4"),
      { DB: db },
      {},
    );
    const verified = await server.fetch(
      req(
        "/api/admin/otp/verify",
        { method: "POST", body: JSON.stringify({ code: "123456" }), headers: { cookie } },
        "10.1.0.4",
      ),
      { DB: db },
      {},
    );
    const both = `${cookie}; ${(verified.headers.get("set-cookie") ?? "").split(";")[0]}`;

    await server.fetch(
      req("/api/admin/logout", { method: "POST", headers: { cookie: both } }, "10.1.0.4"),
      { DB: db },
      {},
    );
    // Fresh login has a session but no grant.
    const cookie2 = cookieFrom(await login(db, "divyansh", "correct-horse-battery-99", "10.1.0.5"));
    const denied = await server.fetch(
      req(
        "/api/admin/items",
        {
          method: "POST",
          body: JSON.stringify({ kind: "blog", title: "x" }),
          headers: { cookie: cookie2 },
        },
        "10.1.0.5",
      ),
      { DB: db },
      {},
    );
    expect(denied.status).toBe(403);

    // No-DB fallback: mutations work without a grant, status says stepUp:false.
    const fbStatus = (await (await server.fetch(req("/api/admin/status"), {}, {})).json()) as {
      stepUp: boolean;
    };
    expect(fbStatus.stepUp).toBe(false);
    // Fallback sessions come from env-admin credentials.
    const { hash, salt } = await hashPassword("fallback-password-123");
    process.env.ADMIN_USERNAME = "divyansh";
    process.env.ADMIN_PASSWORD_HASH = hash;
    process.env.ADMIN_PASSWORD_SALT = salt;
    const fbLogin = await server.fetch(
      req(
        "/api/admin/login",
        {
          method: "POST",
          body: JSON.stringify({ username: "divyansh", password: "fallback-password-123" }),
        },
        "10.1.0.6",
      ),
      {},
      {},
    );
    expect(fbLogin.status).toBe(200);
    const fbCookie = (fbLogin.headers.get("set-cookie") ?? "").split(";")[0] ?? "";
    const fbOtp = await server.fetch(
      req("/api/admin/otp/request", { method: "POST", headers: { cookie: fbCookie } }, "10.1.0.6"),
      {},
      {},
    );
    expect(fbOtp.status).toBe(501);
    const fbCreate = await server.fetch(
      req(
        "/api/admin/items",
        {
          method: "POST",
          body: JSON.stringify({ kind: "blog", title: "local" }),
          headers: { cookie: fbCookie },
        },
        "10.1.0.6",
      ),
      {},
      {},
    );
    expect(fbCreate.status).toBe(201);
  });
});
