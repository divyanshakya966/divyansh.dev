import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { ContentItem, ContentKind } from "@/lib/content";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [{ title: "Admin | Divyansh Shakya" }, { name: "robots", content: "noindex, nofollow" }],
  }),
  component: AdminPage,
});

type Status = { db: boolean; hasAdmin: boolean };
type Tab = ContentKind;

const TABS: { kind: Tab; label: string; hint: string }[] = [
  {
    kind: "certification",
    label: "Certifications",
    hint: "Always visible — seeded with your 2 real certs.",
  },
  {
    kind: "research",
    label: "Research",
    hint: "Hidden on the site until you publish 1 visible item.",
  },
  { kind: "blog", label: "Blogs", hint: "Hidden on the site until you publish 1 visible item." },
];

const EMPTY_FORM = {
  title: "",
  subtitle: "",
  description: "",
  url: "",
  image: "",
  tags: "",
  sort_order: "0",
  is_visible: true,
};

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    credentials: "same-origin",
    headers: { "content-type": "application/json" },
    ...init,
  });
  let data: unknown = null;
  try {
    data = await res.json();
  } catch {
    // ignore
  }
  if (!res.ok) {
    const msg =
      data &&
      typeof data === "object" &&
      "error" in data &&
      typeof (data as { error: unknown }).error === "string"
        ? (data as { error: string }).error
        : `Request failed (${res.status})`;
    throw new Error(msg);
  }
  return data as T;
}

function AdminPage() {
  const [status, setStatus] = useState<Status | null>(null);
  const [user, setUser] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);
  const [tab, setTab] = useState<Tab>("certification");
  const [items, setItems] = useState<ContentItem[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  // Login form
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loggingIn, setLoggingIn] = useState(false);

  // Editor
  const [editingId, setEditingId] = useState<number | string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  // Password change
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [changingPw, setChangingPw] = useState(false);
  const [importingSeeds, setImportingSeeds] = useState(false);

  const refreshStatus = useCallback(async () => {
    try {
      const s = await api<Status>("/api/admin/status");
      setStatus(s);
    } catch {
      setStatus(null);
    }
  }, []);

  const refreshMe = useCallback(async () => {
    try {
      const me = await api<{ user: { username: string } }>("/api/admin/me");
      setUser(me.user.username);
      return true;
    } catch {
      setUser(null);
      return false;
    }
  }, []);

  const refreshItems = useCallback(async () => {
    setLoadingItems(true);
    setError("");
    try {
      const data = await api<{ items: ContentItem[] }>("/api/admin/items?kind=all");
      setItems(Array.isArray(data.items) ? data.items : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load items.");
    } finally {
      setLoadingItems(false);
    }
  }, []);

  useEffect(() => {
    (async () => {
      await refreshStatus();
      const ok = await refreshMe();
      if (ok) await refreshItems();
      setChecking(false);
    })();
  }, [refreshMe, refreshItems, refreshStatus]);

  const visibleItems = useMemo(
    () => items.filter((i) => i.kind === tab).sort((a, b) => a.sort_order - b.sort_order),
    [items, tab],
  );

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setNotice("");
    setLoggingIn(true);
    try {
      const data = await api<{ user: { username: string } }>("/api/admin/login", {
        method: "POST",
        body: JSON.stringify({ username, password }),
      });
      setUser(data.user.username);
      setPassword("");
      await refreshItems();
      setNotice(`Welcome back, ${data.user.username}.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Login failed.");
    } finally {
      setLoggingIn(false);
    }
  }

  async function handleLogout() {
    try {
      await api("/api/admin/logout", { method: "POST" });
    } catch {
      // ignore
    }
    setUser(null);
    setItems([]);
  }

  function openAdd() {
    setEditingId(null);
    setForm({ ...EMPTY_FORM, sort_order: String(visibleItems.length + 1) });
    setFormOpen(true);
    setError("");
  }

  function openEdit(item: ContentItem) {
    if (typeof item.id === "string" && item.id.startsWith("seed")) {
      setError(
        "Seed certifications are read-only — use Add to create your own copy, then hide via admin if needed.",
      );
      return;
    }
    setEditingId(item.id);
    setForm({
      title: item.title,
      subtitle: item.subtitle,
      description: item.description,
      url: item.url,
      image: item.image,
      tags: item.tags.join(", "),
      sort_order: String(item.sort_order),
      is_visible: item.is_visible,
    });
    setFormOpen(true);
    setError("");
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");
    const payload = {
      kind: tab,
      title: form.title.trim(),
      subtitle: form.subtitle.trim(),
      description: form.description.trim(),
      url: form.url.trim(),
      image: form.image.trim(),
      tags: form.tags,
      sort_order: Number(form.sort_order) || 0,
      is_visible: form.is_visible,
    };
    try {
      if (editingId === null) {
        await api("/api/admin/items", { method: "POST", body: JSON.stringify(payload) });
        setNotice("Item added.");
      } else {
        await api(`/api/admin/items/${editingId}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
        setNotice("Item updated.");
      }
      setFormOpen(false);
      await refreshItems();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(item: ContentItem) {
    if (typeof item.id === "string" && item.id.startsWith("seed")) {
      setError("Seed items can't be deleted. Add D1 rows to override them.");
      return;
    }
    if (!window.confirm(`Delete "${item.title}"?`)) return;
    setError("");
    try {
      await api(`/api/admin/items/${item.id}`, { method: "DELETE" });
      setNotice("Item deleted.");
      await refreshItems();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed.");
    }
  }

  async function handleToggle(item: ContentItem) {
    if (typeof item.id === "string" && item.id.startsWith("seed")) {
      setError("Seed items are read-only. Add your own copy to control visibility.");
      return;
    }
    try {
      await api(`/api/admin/items/${item.id}`, {
        method: "PUT",
        body: JSON.stringify({
          kind: item.kind,
          title: item.title,
          subtitle: item.subtitle,
          description: item.description,
          url: item.url,
          image: item.image,
          tags: item.tags,
          sort_order: item.sort_order,
          is_visible: !item.is_visible,
        }),
      });
      await refreshItems();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Toggle failed.");
    }
  }

  async function handleMove(item: ContentItem, dir: -1 | 1) {
    const ordered = [...visibleItems].sort((a, b) => a.sort_order - b.sort_order);
    const idx = ordered.findIndex((i) => String(i.id) === String(item.id));
    const swapIdx = idx + dir;
    if (idx < 0 || swapIdx < 0 || swapIdx >= ordered.length) return;
    const next = [...ordered];
    const tmp = next[idx]!;
    next[idx] = next[swapIdx]!;
    next[swapIdx] = tmp;
    // Optimistic reorder
    setItems((prev) =>
      prev.map((p) => {
        const pos = next.findIndex((n) => String(n.id) === String(p.id));
        return pos >= 0 && p.kind === tab ? { ...p, sort_order: pos + 1 } : p;
      }),
    );
    try {
      const numericIds = next.filter((n) => typeof n.id === "number").map((n) => n.id as number);
      // Seeds have string ids — persist what we can, then refresh.
      if (numericIds.length === next.length) {
        await api("/api/admin/reorder", {
          method: "POST",
          body: JSON.stringify({ kind: tab, ids: numericIds }),
        });
      } else {
        for (let i = 0; i < next.length; i++) {
          const n = next[i]!;
          if (typeof n.id === "number") {
            await api(`/api/admin/items/${n.id}`, {
              method: "PUT",
              body: JSON.stringify({
                kind: n.kind,
                title: n.title,
                subtitle: n.subtitle,
                description: n.description,
                url: n.url,
                image: n.image,
                tags: n.tags,
                sort_order: i + 1,
                is_visible: n.is_visible,
              }),
            });
          }
        }
      }
      await refreshItems();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Reorder failed.");
      await refreshItems();
    }
  }

  async function handlePasswordChange(e: React.FormEvent) {
    e.preventDefault();
    setChangingPw(true);
    setError("");
    setNotice("");
    try {
      await api("/api/admin/password", {
        method: "PUT",
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      setNotice("Password changed. Other sessions were signed out.");
      setCurrentPassword("");
      setNewPassword("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Password change failed.");
    } finally {
      setChangingPw(false);
    }
  }

  async function handleSeedImport() {
    setImportingSeeds(true);
    setError("");
    setNotice("");
    try {
      const data = await api<{ imported: number }>("/api/admin/seed-import", {
        method: "POST",
        body: JSON.stringify({ kind: "certification" }),
      });
      setNotice(`Imported ${data.imported} seed certifications into D1 — now fully editable.`);
      await refreshItems();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Seed import failed.");
    } finally {
      setImportingSeeds(false);
    }
  }

  const showSeedImport = Boolean(
    status?.db && tab === "certification" && !visibleItems.some((i) => typeof i.id === "number"),
  );

  if (checking) {
    return (
      <main className="min-h-screen grid place-items-center bg-background px-4">
        <p className="font-mono text-sm text-muted-foreground">Checking admin session…</p>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="min-h-screen grid place-items-center bg-background px-4 py-16">
        <div className="w-full max-w-sm glass rounded-2xl p-6 sm:p-8">
          <div className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">
            Restricted
          </div>
          <h1 className="mt-2 text-2xl font-bold tracking-tight">Admin sign in</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            This area is private. Sign in with your admin credentials.
          </p>
          {status && !status.hasAdmin && (
            <div className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs leading-relaxed text-amber-200">
              No admin user exists yet. Run <code className="font-mono">npm run admin:create</code>{" "}
              then <code className="font-mono">npx wrangler d1 migrations apply</code>. See{" "}
              <code className="font-mono">docs/ADMIN_SETUP.md</code>.
              {!status.db && (
                <span className="block mt-1">
                  D1 is not bound — login falls back to .dev.vars env admin (local dev only).
                </span>
              )}
            </div>
          )}
          {error && (
            <div
              role="alert"
              className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-200"
            >
              {error}
            </div>
          )}
          {notice && (
            <div
              role="status"
              className="mt-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-200"
            >
              {notice}
            </div>
          )}
          <form onSubmit={handleLogin} className="mt-5 space-y-3">
            <div>
              <label
                htmlFor="username"
                className="text-xs font-mono uppercase tracking-widest text-muted-foreground"
              >
                Username
              </label>
              <input
                id="username"
                name="username"
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                className="mt-2 w-full rounded-xl bg-background/40 border border-border px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>
            <div>
              <label
                htmlFor="password"
                className="text-xs font-mono uppercase tracking-widest text-muted-foreground"
              >
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="mt-2 w-full rounded-xl bg-background/40 border border-border px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>
            <button
              type="submit"
              disabled={loggingIn}
              className="w-full rounded-xl px-4 py-2.5 text-sm font-medium text-primary-foreground bg-gradient-to-r from-cyan to-violet disabled:opacity-60"
            >
              {loggingIn ? "Signing in…" : "Sign in"}
            </button>
          </form>
          <a
            href="/"
            className="mt-4 block text-center text-xs font-mono text-muted-foreground hover:text-foreground"
          >
            ← Back to site
          </a>
        </div>
      </main>
    );
  }

  const activeTab = TABS.find((t) => t.kind === tab)!;

  return (
    <main className="min-h-screen bg-background px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-5xl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">
              divyansh.dev · admin
            </div>
            <h1 className="mt-1 text-2xl font-bold tracking-tight">Content control</h1>
            <p className="text-sm text-muted-foreground">
              Signed in as <span className="font-mono text-foreground">{user}</span>
              {status && (
                <span className="ml-2 font-mono text-xs">
                  · {status.db ? "D1 connected" : "env fallback (local)"}
                </span>
              )}
            </p>
          </div>
          <div className="flex gap-2">
            <a href="/" className="rounded-lg px-3 py-2 text-sm glass hover:bg-muted">
              View site
            </a>
            <button
              onClick={handleLogout}
              className="rounded-lg px-3 py-2 text-sm border border-border hover:bg-muted"
            >
              Sign out
            </button>
          </div>
        </div>

        {error && (
          <div
            role="alert"
            className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200"
          >
            {error}
          </div>
        )}
        {notice && (
          <div
            role="status"
            className="mt-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-200"
          >
            {notice}
          </div>
        )}

        <div className="mt-6 flex flex-wrap gap-2" role="tablist" aria-label="Content types">
          {TABS.map((t) => (
            <button
              key={t.kind}
              role="tab"
              aria-selected={tab === t.kind}
              onClick={() => {
                setTab(t.kind);
                setFormOpen(false);
                setError("");
                setNotice("");
              }}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                tab === t.kind
                  ? "bg-gradient-to-r from-cyan to-violet text-primary-foreground"
                  : "glass hover:bg-muted"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs font-mono text-muted-foreground">{activeTab.hint}</p>

        <div className="mt-4 glass rounded-2xl p-4 sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-semibold">
              {activeTab.label}{" "}
              <span className="ml-1 font-mono text-xs text-muted-foreground">
                {visibleItems.length} item{visibleItems.length === 1 ? "" : "s"}
              </span>
            </h2>
            <div className="flex gap-2">
              <button
                onClick={refreshItems}
                disabled={loadingItems}
                className="rounded-lg px-3 py-1.5 text-xs border border-border hover:bg-muted disabled:opacity-60"
              >
                {loadingItems ? "Refreshing…" : "Refresh"}
              </button>
              <button
                onClick={openAdd}
                className="rounded-lg px-3 py-1.5 text-xs font-medium text-primary-foreground bg-gradient-to-r from-cyan to-violet"
              >
                + Add
              </button>
            </div>
          </div>

          {loadingItems ? (
            <p className="mt-4 font-mono text-xs text-muted-foreground">Loading…</p>
          ) : visibleItems.length === 0 ? (
            <div className="mt-4 rounded-xl border border-dashed border-border p-6 text-center">
              <p className="text-sm text-muted-foreground">
                Nothing here yet.{" "}
                {tab === "certification"
                  ? "Seed certs show on the site until D1 rows exist."
                  : "This section stays hidden on the site until you add a visible item."}
              </p>
              <div className="mt-3 flex flex-wrap justify-center gap-2">
                <button
                  onClick={openAdd}
                  className="rounded-lg px-4 py-2 text-sm glass hover:bg-muted"
                >
                  Add your first {activeTab.label.toLowerCase().slice(0, -1) || "item"}
                </button>
                {showSeedImport && (
                  <button
                    onClick={handleSeedImport}
                    disabled={importingSeeds}
                    className="rounded-lg px-4 py-2 text-sm border border-border hover:bg-muted disabled:opacity-60"
                  >
                    {importingSeeds ? "Importing…" : "Import seed certifications"}
                  </button>
                )}
              </div>
            </div>
          ) : (
            <ul className="mt-4 space-y-2">
              {visibleItems.map((item, idx) => {
                const readOnly = typeof item.id === "string" && String(item.id).startsWith("seed");
                return (
                  <li
                    key={String(item.id)}
                    className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-background/40 px-3 py-2.5"
                  >
                    <span className="font-mono text-xs text-muted-foreground w-8">#{idx + 1}</span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold">
                        {item.title}
                        {readOnly && (
                          <span className="ml-2 rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                            seed
                          </span>
                        )}
                        {!item.is_visible && (
                          <span className="ml-2 rounded bg-amber-500/15 px-1.5 py-0.5 font-mono text-[10px] text-amber-200">
                            hidden
                          </span>
                        )}
                      </div>
                      {item.subtitle && (
                        <div className="truncate font-mono text-[11px] text-muted-foreground">
                          {item.subtitle}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleMove(item, -1)}
                        disabled={idx === 0 || readOnly}
                        aria-label="Move up"
                        className="grid h-7 w-7 place-items-center rounded-md hover:bg-muted disabled:opacity-30"
                      >
                        ↑
                      </button>
                      <button
                        onClick={() => handleMove(item, 1)}
                        disabled={idx === visibleItems.length - 1 || readOnly}
                        aria-label="Move down"
                        className="grid h-7 w-7 place-items-center rounded-md hover:bg-muted disabled:opacity-30"
                      >
                        ↓
                      </button>
                      <button
                        onClick={() => handleToggle(item)}
                        disabled={readOnly}
                        className="rounded-md px-2 py-1 text-xs hover:bg-muted disabled:opacity-30"
                      >
                        {item.is_visible ? "Hide" : "Show"}
                      </button>
                      <button
                        onClick={() => openEdit(item)}
                        className="rounded-md px-2 py-1 text-xs hover:bg-muted"
                      >
                        Edit
                      </button>
                      {!readOnly && (
                        <button
                          onClick={() => handleDelete(item)}
                          className="rounded-md px-2 py-1 text-xs text-red-300 hover:bg-red-500/10"
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          {formOpen && (
            <form
              onSubmit={handleSave}
              className="mt-4 rounded-xl border border-border p-4 space-y-3 bg-background/40"
            >
              <h3 className="font-semibold text-sm">
                {editingId === null ? `Add ${activeTab.label.toLowerCase()}` : "Edit item"}
              </h3>
              <div className="grid sm:grid-cols-2 gap-3">
                <label className="block sm:col-span-2">
                  <span className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
                    Title *
                  </span>
                  <input
                    value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                    required
                    maxLength={160}
                    className="mt-1.5 w-full rounded-lg bg-background/60 border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                    placeholder={
                      tab === "blog"
                        ? "How I hardened my homelab"
                        : tab === "research"
                          ? "Paper title"
                          : "Certificate name"
                    }
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
                    Subtitle
                  </span>
                  <input
                    value={form.subtitle}
                    onChange={(e) => setForm({ ...form, subtitle: e.target.value })}
                    maxLength={160}
                    className="mt-1.5 w-full rounded-lg bg-background/60 border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                    placeholder="TryHackMe · 2026 / Venue / Platform"
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
                    URL
                  </span>
                  <input
                    value={form.url}
                    onChange={(e) => setForm({ ...form, url: e.target.value })}
                    inputMode="url"
                    placeholder="https://… verify / article link"
                    className="mt-1.5 w-full rounded-lg bg-background/60 border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                  />
                </label>
                <label className="block sm:col-span-2">
                  <span className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
                    Description
                  </span>
                  <textarea
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    rows={4}
                    maxLength={4000}
                    className="mt-1.5 w-full rounded-lg bg-background/60 border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 resize-y"
                    placeholder="What is this? Skills covered, findings, takeaways…"
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
                    Tags (comma separated)
                  </span>
                  <input
                    value={form.tags}
                    onChange={(e) => setForm({ ...form, tags: e.target.value })}
                    className="mt-1.5 w-full rounded-lg bg-background/60 border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                    placeholder="Web Security, SOC, Kubernetes"
                  />
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <label className="block">
                    <span className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
                      Sort order
                    </span>
                    <input
                      value={form.sort_order}
                      onChange={(e) => setForm({ ...form, sort_order: e.target.value })}
                      inputMode="numeric"
                      className="mt-1.5 w-full rounded-lg bg-background/60 border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                    />
                  </label>
                  <label className="flex items-end gap-2 pb-2">
                    <input
                      type="checkbox"
                      checked={form.is_visible}
                      onChange={(e) => setForm({ ...form, is_visible: e.target.checked })}
                      className="h-4 w-4 accent-current"
                    />
                    <span className="text-sm">Visible on site</span>
                  </label>
                </div>
                <label className="block sm:col-span-2">
                  <span className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
                    Image URL (optional)
                  </span>
                  <input
                    value={form.image}
                    onChange={(e) => setForm({ ...form, image: e.target.value })}
                    inputMode="url"
                    placeholder="/certs/… or https://…"
                    className="mt-1.5 w-full rounded-lg bg-background/60 border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                  />
                </label>
              </div>
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-lg px-4 py-2 text-sm font-medium text-primary-foreground bg-gradient-to-r from-cyan to-violet disabled:opacity-60"
                >
                  {saving ? "Saving…" : editingId === null ? "Add item" : "Save changes"}
                </button>
                <button
                  type="button"
                  onClick={() => setFormOpen(false)}
                  className="rounded-lg px-4 py-2 text-sm border border-border hover:bg-muted"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}
        </div>

        <div className="mt-4 glass rounded-2xl p-4 sm:p-6">
          <h2 className="font-semibold">Change password</h2>
          <p className="mt-1 font-mono text-xs text-muted-foreground">
            Min 12 characters.{" "}
            {status && !status.db
              ? "Needs D1 in production — env fallback can't rotate here."
              : "Other sessions are signed out."}
          </p>
          <form onSubmit={handlePasswordChange} className="mt-3 grid sm:grid-cols-3 gap-3">
            <label className="block">
              <span className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
                Current
              </span>
              <input
                type="password"
                autoComplete="current-password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
                className="mt-1.5 w-full rounded-lg bg-background/60 border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </label>
            <label className="block">
              <span className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
                New (12+ chars)
              </span>
              <input
                type="password"
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                minLength={12}
                className="mt-1.5 w-full rounded-lg bg-background/60 border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </label>
            <div className="flex items-end">
              <button
                type="submit"
                disabled={changingPw}
                className="rounded-lg px-4 py-2 text-sm border border-border hover:bg-muted disabled:opacity-60"
              >
                {changingPw ? "Changing…" : "Change"}
              </button>
            </div>
          </form>
        </div>

        <p className="mt-4 font-mono text-[11px] text-muted-foreground">
          Sorting: use ↑ ↓ — order saves automatically and the public site follows sort_order.
          Hidden items never render publicly. Research &amp; Blogs sections auto-hide when empty.
        </p>
      </div>
    </main>
  );
}
