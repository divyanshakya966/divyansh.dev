import { describe, expect, it, beforeEach } from "vitest";
import server from "@/server";
import { FakeD1, authedCookies, cookieFrom, login, req, seedAdmin } from "./fake-d1";

function fakeBucket() {
  const store = new Map<string, { bytes: Uint8Array; type: string }>();
  return {
    store,
    async put(
      key: string,
      value: ArrayBuffer,
      options?: { httpMetadata?: Record<string, string> },
    ) {
      store.set(key, {
        bytes: new Uint8Array(value),
        type: options?.httpMetadata?.contentType ?? "",
      });
    },
    async get(key: string) {
      const hit = store.get(key);
      if (!hit) return null;
      const bytes = hit.bytes;
      return {
        body: new ReadableStream<Uint8Array>({
          start(controller) {
            controller.enqueue(bytes);
            controller.close();
          },
        }),
        httpMetadata: { contentType: hit.type },
      };
    },
  };
}

async function authed(db: FakeD1, ip: string) {
  await seedAdmin(db, "divyansh", "correct-horse-battery-99");
  const cookie = cookieFrom(await login(db, "divyansh", "correct-horse-battery-99", ip));
  return { cookie: await authedCookies(db, cookie) };
}

function uploadReq(
  cookie: string,
  filename: string,
  type: string,
  content: string,
  ip: string,
): Request {
  // Hand-built multipart: jsdom's File/FormData don't survive undici
  // serialization, so raw bodies keep the test on the real server path.
  const boundary = "----vitestboundary42";
  const body =
    `--${boundary}\r\n` +
    `Content-Disposition: form-data; name="file"; filename="${filename}"\r\n` +
    `Content-Type: ${type}\r\n\r\n` +
    `${content}\r\n` +
    `--${boundary}--\r\n`;
  return new Request("http://localhost/api/admin/upload", {
    method: "POST",
    headers: {
      cookie,
      "cf-connecting-ip": ip,
      "content-type": `multipart/form-data; boundary=${boundary}`,
    },
    body,
  });
}

const PNG_CONTENT = "fake-png-bytes";

describe("media uploads", () => {
  it("501s without a bound bucket", async () => {
    const db = new FakeD1();
    const auth = await authed(db, "10.2.0.1");
    const res = await server.fetch(
      uploadReq(auth.cookie, "shot.png", "image/png", PNG_CONTENT, "10.2.0.1"),
      { DB: db },
      {},
    );
    expect(res.status).toBe(501);
  });

  it("rejects unauthenticated and un-granted uploads", async () => {
    const db = new FakeD1();
    const anon = await server.fetch(
      uploadReq("", "shot.png", "image/png", PNG_CONTENT, "10.2.0.2"),
      { DB: db },
      {},
    );
    expect(anon.status).toBe(401);

    await seedAdmin(db, "divyansh", "correct-horse-battery-99");
    const sessionOnly = cookieFrom(
      await login(db, "divyansh", "correct-horse-battery-99", "10.2.0.3"),
    );
    const denied = await server.fetch(
      uploadReq(sessionOnly, "shot.png", "image/png", PNG_CONTENT, "10.2.0.3"),
      { DB: db },
      {},
    );
    expect(denied.status).toBe(403);
  });

  it("stores and serves an image round-trip", async () => {
    const db = new FakeD1();
    const bucket = fakeBucket();
    const auth = await authed(db, "10.2.0.4");
    const up = await server.fetch(
      uploadReq(auth.cookie, "shot.png", "image/png", PNG_CONTENT, "10.2.0.4"),
      { DB: db, R2_BUCKET: bucket },
      {},
    );
    expect(up.status).toBe(201);
    const data = (await up.json()) as { ok: boolean; url: string };
    expect(data.ok).toBe(true);
    expect(data.url).toMatch(/^\/media\/uploads\/1\/\d+-[0-9a-f]+\.png$/);

    const got = await server.fetch(req(data.url), { DB: db, R2_BUCKET: bucket }, {});
    expect(got.status).toBe(200);
    expect(got.headers.get("content-type")).toBe("image/png");
    expect(got.headers.get("cache-control")).toContain("immutable");
    expect(await got.text()).toBe(PNG_CONTENT);
  });

  it("rejects non-images, oversized files and traversal reads", async () => {
    const db = new FakeD1();
    const bucket = fakeBucket();
    const auth = await authed(db, "10.2.0.5");
    const env = { DB: db, R2_BUCKET: bucket };

    const exe = await server.fetch(
      uploadReq(auth.cookie, "evil.exe", "application/x-msdownload", "x", "10.2.0.5"),
      env,
      {},
    );
    expect(exe.status).toBe(400);

    const big = await server.fetch(
      uploadReq(auth.cookie, "big.png", "image/png", "x".repeat(2 * 1024 * 1024 + 10), "10.2.0.5"),
      env,
      {},
    );
    expect(big.status).toBe(400);

    const missing = await server.fetch(req("/media/uploads/1/nope.png"), env, {});
    expect(missing.status).toBe(404);

    // Single-encoded ".." is normalized away by URL parsing before routing;
    // double-encoded traversal must still be rejected by the key guard.
    const traversal = await server.fetch(req("/media/%252e%252e%2fsecret"), env, {});
    expect(traversal.status).toBe(404);
  });
});
