import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { SEEDS, metaString, type ContentItem, type ContentKind } from "@/lib/content";
import { SETTING_DEFS } from "@/lib/settings";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [{ title: "Admin | Divyansh Shakya" }, { name: "robots", content: "noindex, nofollow" }],
  }),
  component: AdminPage,
});

type Status = { db: boolean; hasAdmin: boolean; metaReady: boolean; stepUp: boolean };
type Tab = ContentKind | "settings";

const TABS: { kind: Tab; label: string; hint: string }[] = [
  {
    kind: "certification",
    label: "Certifications",
    hint: "Always visible while ≥1 item is visible.",
  },
  { kind: "project", label: "Projects", hint: "Selected work cards + detail dialog." },
  { kind: "experience", label: "Experience", hint: "Timeline entries. meta: { when, tag }." },
  {
    kind: "achievement",
    label: "Achievements",
    hint: "Highlight cards. meta: { icon: trophy|award|badge|star }.",
  },
  { kind: "skill", label: "Skills", hint: "Groups. Title = group name, tags = skills." },
  {
    kind: "about",
    label: "About cards",
    hint: "Focus cards. meta: { icon: shield|cloud|code|terminal }.",
  },
  {
    kind: "building",
    label: "Status cards",
    hint: "meta.card is build|learn|now. learn uses meta.lines[], now uses meta.stats[{l,v}].",
  },
  {
    kind: "research",
    label: "Research",
    hint: "Hidden on the site until you publish 1 visible item.",
  },
  { kind: "blog", label: "Blogs", hint: "Hidden on the site until you publish 1 visible item." },
  {
    kind: "settings",
    label: "Site settings",
    hint: "Hero text, contact details, footer link, section on/off.",
  },
];

const KIND_META_HELP: Record<ContentKind, string> = {
  certification: "No meta needed. Tags = skill chips.",
  research: "No meta needed. URL = paper/read link.",
  blog: "No meta needed. URL = article link (optional).",
  project:
    'meta: { "long": "dialog text", "demo": "https://live-url (optional)" }. URL = repo. Subtitle = tag. Tags = stack.',
  experience:
    'meta: { "when": "May 2026 – July 2026", "tag": "Open Source" }. Subtitle = venue. Tags = filter chips.',
  achievement: 'meta: { "icon": "trophy|award|badge|star" }. Subtitle = sub-line.',
  skill: "No meta needed. Title = group name, tags = skills.",
  about: 'meta: { "icon": "shield|cloud|code|terminal" }. Description = card body.',
  building: 'meta.card build|learn|now. learn: { "lines": [...] }. now: { "stats": [{"l","v"}] }.',
};

const EMPTY_FORM = {
  title: "",
  subtitle: "",
  description: "",
  url: "",
  image: "",
  tags: "",
  meta: "",
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
    // non-JSON body: error message falls back to status text below
  }
  if (!res.ok) {
    const err =
      data && typeof data === "object" && "error" in data
        ? (data as { error?: unknown; code?: unknown })
        : {};
    const msg = typeof err.error === "string" ? err.error : `Request failed (${res.status})`;
    const error = new Error(msg) as Error & { code?: string };
    if (typeof err.code === "string") error.code = err.code;
    throw error;
  }
  return data as T;
}

function isOtpRequired(error: unknown): boolean {
  return (
    !!error && typeof error === "object" && (error as { code?: unknown }).code === "OTP_REQUIRED"
  );
}

function downloadJson(filename: string, value: unknown) {
  const blob = new Blob([JSON.stringify(value, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
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
  const [importingFile, setImportingFile] = useState(false);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Site settings
  const [serverSettings, setServerSettings] = useState<Record<string, string>>({});
  const [settingsDraft, setSettingsDraft] = useState<Record<string, string>>({});
  const [loadingSettings, setLoadingSettings] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);

  // Step-up verification (emailed one-time code, required for all saves)
  const [otp, setOtp] = useState<{ verified: boolean; expiresAt: number | null }>({
    verified: false,
    expiresAt: null,
  });
  const [otpCode, setOtpCode] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [requestingOtp, setRequestingOtp] = useState(false);
  const [verifyingOtp, setVerifyingOtp] = useState(false);

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

  const refreshSettings = useCallback(async () => {
    setLoadingSettings(true);
    try {
      const data = await api<{ settings: Record<string, string> }>("/api/admin/settings");
      const s = data.settings ?? {};
      setServerSettings(s);
      setSettingsDraft(s);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load settings.");
    } finally {
      setLoadingSettings(false);
    }
  }, []);

  const refreshOtp = useCallback(async () => {
    try {
      const data = await api<{ verified: boolean; expiresAt: number | null }>(
        "/api/admin/otp/status",
      );
      setOtp({ verified: data.verified === true, expiresAt: data.expiresAt ?? null });
    } catch {
      setOtp({ verified: false, expiresAt: null });
    }
  }, []);

  useEffect(() => {
    (async () => {
      await refreshStatus();
      const ok = await refreshMe();
      if (ok) {
        await refreshItems();
        await refreshSettings();
        await refreshOtp();
      }
      setChecking(false);
    })();
  }, [refreshMe, refreshItems, refreshOtp, refreshSettings, refreshStatus]);

  const isKindTab = tab !== "settings";
  const activeKind = isKindTab ? (tab as ContentKind) : null;
  const visibleItems = useMemo(
    () =>
      activeKind
        ? items.filter((i) => i.kind === activeKind).sort((a, b) => a.sort_order - b.sort_order)
        : [],
    [items, activeKind],
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
      await refreshSettings();
      await refreshOtp();
      setNotice(`Welcome back, ${data.user.username}. Verify the emailed code to make changes.`);
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
      // already logged out server-side — still clear local state below
    }
    setUser(null);
    setItems([]);
    // Never carry session-scoped messages onto the signed-out login form:
    // a stale "Verified…" notice would mislead (and reveal timing to the
    // next viewer of this screen).
    setError("");
    setNotice("");
    setOtp({ verified: false, expiresAt: null });
    setOtpCode("");
    setOtpSent(false);
  }

  function noteOtpRequired() {
    setError(
      "Step-up verification required — verify the emailed code below, then retry your save.",
    );
  }

  function fail(e: unknown, fallback: string) {
    if (isOtpRequired(e)) noteOtpRequired();
    else setError(e instanceof Error ? e.message : fallback);
  }

  async function handleRequestOtp() {
    setRequestingOtp(true);
    setError("");
    setNotice("");
    try {
      const data = await api<{ expiresIn: number }>("/api/admin/otp/request", { method: "POST" });
      setOtpSent(true);
      setNotice(`Code sent to your email (expires in ${Math.floor(data.expiresIn / 60)} min).`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to send code.");
    } finally {
      setRequestingOtp(false);
    }
  }

  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    setVerifyingOtp(true);
    setError("");
    setNotice("");
    try {
      const data = await api<{ expiresAt: number }>("/api/admin/otp/verify", {
        method: "POST",
        body: JSON.stringify({ code: otpCode.trim() }),
      });
      setOtp({ verified: true, expiresAt: data.expiresAt });
      setOtpCode("");
      setNotice("Verified — you can now save changes for the next 10 minutes.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Verification failed.");
    } finally {
      setVerifyingOtp(false);
    }
  }

  async function handleRevokeOtp() {
    try {
      await api("/api/admin/otp/revoke", { method: "POST" });
    } catch {
      // grant already gone server-side — still clear local state below
    }
    setOtp({ verified: false, expiresAt: null });
    setOtpCode("");
  }

  function openAdd() {
    if (!activeKind) return;
    setEditingId(null);
    setForm({ ...EMPTY_FORM, sort_order: String(visibleItems.length + 1) });
    setFormOpen(true);
    setError("");
  }

  function openEdit(item: ContentItem) {
    if (typeof item.id === "string" && String(item.id).startsWith("seed")) {
      setError("Seed items are read-only — import them to D1 first to edit.");
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
      meta: metaString(item.meta),
      sort_order: String(item.sort_order),
      is_visible: item.is_visible,
    });
    setFormOpen(true);
    setError("");
  }

  function itemPayload() {
    return {
      kind: activeKind,
      title: form.title.trim(),
      subtitle: form.subtitle.trim(),
      description: form.description.trim(),
      url: form.url.trim(),
      image: form.image.trim(),
      tags: form.tags,
      meta: form.meta.trim(),
      sort_order: Number(form.sort_order) || 0,
      is_visible: form.is_visible,
    };
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");
    try {
      if (editingId === null) {
        await api("/api/admin/items", { method: "POST", body: JSON.stringify(itemPayload()) });
        setNotice("Item added.");
      } else {
        await api(`/api/admin/items/${editingId}`, {
          method: "PUT",
          body: JSON.stringify(itemPayload()),
        });
        setNotice("Item updated.");
      }
      setFormOpen(false);
      await refreshItems();
    } catch (e) {
      fail(e, "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(item: ContentItem) {
    if (typeof item.id === "string" && String(item.id).startsWith("seed")) {
      setError("Seed items can't be deleted. Import them to D1 first.");
      return;
    }
    // Two-step inline confirm (no blocking native dialog): first click arms,
    // second click within 4s deletes.
    if (confirmingId !== String(item.id)) {
      setConfirmingId(String(item.id));
      window.setTimeout(() => {
        setConfirmingId((cur) => (cur === String(item.id) ? null : cur));
      }, 4000);
      return;
    }
    setConfirmingId(null);
    setError("");
    try {
      await api(`/api/admin/items/${item.id}`, { method: "DELETE" });
      setNotice("Item deleted.");
      await refreshItems();
    } catch (e) {
      fail(e, "Delete failed.");
    }
  }

  async function handleToggle(item: ContentItem) {
    if (typeof item.id === "string" && String(item.id).startsWith("seed")) {
      setError("Seed items are read-only. Import them to D1 first.");
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
          meta: item.meta ?? {},
          sort_order: item.sort_order,
          is_visible: !item.is_visible,
        }),
      });
      await refreshItems();
    } catch (e) {
      fail(e, "Toggle failed.");
    }
  }

  async function handleMove(item: ContentItem, dir: -1 | 1) {
    if (!activeKind) return;
    const ordered = [...visibleItems].sort((a, b) => a.sort_order - b.sort_order);
    const idx = ordered.findIndex((i) => String(i.id) === String(item.id));
    const swapIdx = idx + dir;
    if (idx < 0 || swapIdx < 0 || swapIdx >= ordered.length) return;
    const next = [...ordered];
    const tmp = next[idx]!;
    next[idx] = next[swapIdx]!;
    next[swapIdx] = tmp;
    setItems((prev) =>
      prev.map((p) => {
        const pos = next.findIndex((n) => String(n.id) === String(p.id));
        return pos >= 0 && p.kind === activeKind ? { ...p, sort_order: pos + 1 } : p;
      }),
    );
    try {
      const numericIds = next.filter((n) => typeof n.id === "number").map((n) => n.id as number);
      if (numericIds.length === next.length) {
        await api("/api/admin/reorder", {
          method: "POST",
          body: JSON.stringify({ kind: activeKind, ids: numericIds }),
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
                meta: n.meta ?? {},
                sort_order: i + 1,
                is_visible: n.is_visible,
              }),
            });
          }
        }
      }
      await refreshItems();
    } catch (e) {
      fail(e, "Reorder failed.");
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
      fail(e, "Password change failed.");
    } finally {
      setChangingPw(false);
    }
  }

  async function handleSeedImport() {
    if (!activeKind) return;
    setImportingSeeds(true);
    setError("");
    setNotice("");
    try {
      const data = await api<{ imported: number }>("/api/admin/seed-import", {
        method: "POST",
        body: JSON.stringify({ kind: activeKind }),
      });
      setNotice(`Imported ${data.imported} seed(s) into D1 — now fully editable.`);
      await refreshItems();
    } catch (e) {
      fail(e, "Seed import failed.");
    } finally {
      setImportingSeeds(false);
    }
  }

  function handleExport() {
    if (!activeKind) return;
    downloadJson(`${activeKind}-export.json`, visibleItems);
    setNotice(`Exported ${visibleItems.length} ${activeKind} item(s).`);
  }

  async function handleImportFile(file: File) {
    if (!activeKind) return;
    setImportingFile(true);
    setError("");
    setNotice("");
    try {
      const text = await file.text();
      const parsed: unknown = JSON.parse(text);
      const arr = Array.isArray(parsed)
        ? parsed
        : parsed &&
            typeof parsed === "object" &&
            Array.isArray((parsed as { items?: unknown }).items)
          ? (parsed as { items: unknown[] }).items
          : null;
      if (!arr) throw new Error("File must contain a JSON array (or { items: [...] }).");
      if (arr.length === 0) throw new Error("Nothing to import.");
      if (arr.length > 200) throw new Error("Import is capped at 200 items per file.");
      let added = 0;
      const skipped: number[] = [];
      for (let idx = 0; idx < arr.length; idx++) {
        const raw = arr[idx];
        if (!raw || typeof raw !== "object") {
          skipped.push(idx + 1);
          continue;
        }
        try {
          const body = { ...(raw as Record<string, unknown>), kind: activeKind };
          await api("/api/admin/items", { method: "POST", body: JSON.stringify(body) });
          added++;
        } catch (e) {
          // A missing grant aborts the whole batch (don't misreport as bad rows).
          if (isOtpRequired(e)) throw e;
          skipped.push(idx + 1);
        }
      }
      const skippedNote =
        skipped.length > 0
          ? `, skipped ${skipped.length} (row${skipped.length === 1 ? "" : "s"} ${skipped.slice(0, 8).join(", ")}${skipped.length > 8 ? "…" : ""})`
          : "";
      setNotice(`Imported ${added} item(s) into ${activeKind}${skippedNote}.`);
      await refreshItems();
    } catch (e) {
      fail(e, "Import failed.");
    } finally {
      setImportingFile(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function handleSaveSettings(e: React.FormEvent) {
    e.preventDefault();
    setSavingSettings(true);
    setError("");
    setNotice("");
    try {
      let saved = 0;
      for (const def of SETTING_DEFS) {
        const draft = settingsDraft[def.key] ?? "";
        if (draft !== (serverSettings[def.key] ?? "")) {
          await api("/api/admin/settings", {
            method: "PUT",
            body: JSON.stringify({ key: def.key, value: draft }),
          });
          saved++;
        }
      }
      setNotice(saved === 0 ? "No changes to save." : `Saved ${saved} setting(s).`);
      await refreshSettings();
    } catch (e) {
      fail(e, "Save failed.");
    } finally {
      setSavingSettings(false);
    }
  }

  async function handleResetSetting(key: string) {
    setError("");
    try {
      await api(`/api/admin/settings/${encodeURIComponent(key)}`, { method: "DELETE" });
      await refreshSettings();
      setNotice("Setting reset to default.");
    } catch (e) {
      fail(e, "Reset failed.");
    }
  }

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
  const showSeedImport = Boolean(
    isKindTab &&
    activeKind &&
    status?.db &&
    SEEDS[activeKind].length > 0 &&
    !visibleItems.some((i) => typeof i.id === "number"),
  );

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
                  {status.db && (
                    <span className={otp.verified ? "text-emerald-300" : "text-amber-300"}>
                      {" "}
                      · {otp.verified ? "step-up verified" : "step-up required for saves"}
                    </span>
                  )}
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

        {status?.db === true && (
          <div className="mt-4 glass rounded-2xl p-4 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-semibold text-sm">Two-step verification</h2>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {otp.verified
                    ? `Verified${otp.expiresAt ? ` until ${new Date(otp.expiresAt).toLocaleTimeString()}` : ""} — saves, password change and settings work.`
                    : "Every save, password change and settings edit needs a one-time code emailed to you."}
                </p>
              </div>
              {otp.verified ? (
                <button
                  onClick={handleRevokeOtp}
                  className="rounded-lg px-3 py-1.5 text-xs border border-border hover:bg-muted"
                >
                  Lock changes
                </button>
              ) : (
                <button
                  onClick={handleRequestOtp}
                  disabled={requestingOtp}
                  className="rounded-lg px-3 py-1.5 text-xs font-medium text-primary-foreground bg-gradient-to-r from-cyan to-violet disabled:opacity-60"
                >
                  {requestingOtp ? "Sending…" : otpSent ? "Resend code" : "Email me a code"}
                </button>
              )}
            </div>
            {!otp.verified && otpSent && (
              <form onSubmit={handleVerifyOtp} className="mt-3 flex flex-wrap items-end gap-2">
                <label className="block">
                  <span className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
                    6-digit code
                  </span>
                  <input
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    placeholder="123456"
                    className="mt-1.5 w-40 rounded-lg bg-background/60 border border-border px-3 py-2 text-sm tracking-[0.3em] focus:outline-none focus:ring-2 focus:ring-primary/40"
                  />
                </label>
                <button
                  type="submit"
                  disabled={verifyingOtp || otpCode.length !== 6}
                  className="rounded-lg px-4 py-2 text-sm font-medium text-primary-foreground bg-gradient-to-r from-cyan to-violet disabled:opacity-60"
                >
                  {verifyingOtp ? "Verifying…" : "Verify"}
                </button>
              </form>
            )}
          </div>
        )}

        {error && (
          <div
            role="alert"
            className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200"
          >
            {error}
          </div>
        )}
        {status?.db === true && status.metaReady === false && (
          <div
            role="alert"
            className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-200"
          >
            Database schema is outdated (missing migration 0002). Run{" "}
            <code className="font-mono">npm run db:migrate:remote</code> (and{" "}
            <code className="font-mono">:local</code> for dev), then Refresh. The public site keeps
            serving seed content meanwhile.
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

        {tab === "settings" ? (
          <div className="mt-4 glass rounded-2xl p-4 sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-semibold">Site settings</h2>
              <button
                onClick={refreshSettings}
                disabled={loadingSettings}
                className="rounded-lg px-3 py-1.5 text-xs border border-border hover:bg-muted disabled:opacity-60"
              >
                {loadingSettings ? "Refreshing…" : "Refresh"}
              </button>
            </div>
            {loadingSettings ? (
              <p className="mt-4 font-mono text-xs text-muted-foreground">Loading…</p>
            ) : (
              <form onSubmit={handleSaveSettings} className="mt-4 space-y-4">
                {SETTING_DEFS.map((def) => {
                  const val = settingsDraft[def.key] ?? "";
                  const changed = val !== (serverSettings[def.key] ?? "");
                  return (
                    <div key={def.key}>
                      <div className="flex items-center justify-between gap-2">
                        <label
                          htmlFor={`setting-${def.key}`}
                          className="text-xs font-mono uppercase tracking-widest text-muted-foreground"
                        >
                          {def.label}
                          {changed && <span className="ml-2 text-amber-300">· edited</span>}
                        </label>
                        <button
                          type="button"
                          onClick={() => handleResetSetting(def.key)}
                          className="font-mono text-[11px] text-muted-foreground hover:text-foreground"
                        >
                          reset
                        </button>
                      </div>
                      {def.hint && (
                        <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">
                          {def.hint}
                        </p>
                      )}
                      {def.type === "boolean" ? (
                        <label className="mt-1.5 flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={val !== "0"}
                            onChange={(e) =>
                              setSettingsDraft({
                                ...settingsDraft,
                                [def.key]: e.target.checked ? "1" : "0",
                              })
                            }
                            className="h-4 w-4 accent-current"
                          />
                          <span className="text-sm">
                            {val !== "0" ? "Shown on site" : "Hidden from site"}
                          </span>
                        </label>
                      ) : def.type === "textarea" || def.type === "list" ? (
                        <textarea
                          id={`setting-${def.key}`}
                          value={val}
                          onChange={(e) =>
                            setSettingsDraft({ ...settingsDraft, [def.key]: e.target.value })
                          }
                          rows={def.type === "list" ? 4 : 3}
                          className="mt-1.5 w-full rounded-lg bg-background/60 border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 resize-y font-mono"
                        />
                      ) : (
                        <input
                          id={`setting-${def.key}`}
                          value={val}
                          onChange={(e) =>
                            setSettingsDraft({ ...settingsDraft, [def.key]: e.target.value })
                          }
                          className="mt-1.5 w-full rounded-lg bg-background/60 border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                        />
                      )}
                      <p className="mt-0.5 font-mono text-[11px] text-muted-foreground break-all">
                        key: {def.key}
                      </p>
                    </div>
                  );
                })}
                <button
                  type="submit"
                  disabled={savingSettings}
                  className="rounded-lg px-4 py-2 text-sm font-medium text-primary-foreground bg-gradient-to-r from-cyan to-violet disabled:opacity-60"
                >
                  {savingSettings ? "Saving…" : "Save settings"}
                </button>
              </form>
            )}
          </div>
        ) : (
          <div className="mt-4 glass rounded-2xl p-4 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-semibold">
                {activeTab.label}{" "}
                <span className="ml-1 font-mono text-xs text-muted-foreground">
                  {visibleItems.length} item{visibleItems.length === 1 ? "" : "s"}
                </span>
              </h2>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={refreshItems}
                  disabled={loadingItems}
                  className="rounded-lg px-3 py-1.5 text-xs border border-border hover:bg-muted disabled:opacity-60"
                >
                  {loadingItems ? "Refreshing…" : "Refresh"}
                </button>
                <button
                  onClick={handleExport}
                  disabled={visibleItems.length === 0}
                  className="rounded-lg px-3 py-1.5 text-xs border border-border hover:bg-muted disabled:opacity-30"
                >
                  Export JSON
                </button>
                <button
                  onClick={() => fileRef.current?.click()}
                  disabled={importingFile}
                  className="rounded-lg px-3 py-1.5 text-xs border border-border hover:bg-muted disabled:opacity-60"
                >
                  {importingFile ? "Importing…" : "Import JSON"}
                </button>
                <input
                  ref={fileRef}
                  type="file"
                  accept="application/json,.json"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleImportFile(f);
                  }}
                />
                <button
                  onClick={openAdd}
                  className="rounded-lg px-3 py-1.5 text-xs font-medium text-primary-foreground bg-gradient-to-r from-cyan to-violet"
                >
                  + Add
                </button>
              </div>
            </div>
            <p className="mt-2 font-mono text-[11px] text-muted-foreground">
              {activeKind ? KIND_META_HELP[activeKind] : ""}
            </p>

            {loadingItems ? (
              <p className="mt-4 font-mono text-xs text-muted-foreground">Loading…</p>
            ) : visibleItems.length === 0 ? (
              <div className="mt-4 rounded-xl border border-dashed border-border p-6 text-center">
                <p className="text-sm text-muted-foreground">
                  Nothing here yet.{" "}
                  {activeKind === "certification"
                    ? "Seed certs show on the site until D1 rows exist."
                    : activeKind === "research" || activeKind === "blog"
                      ? "This section stays hidden on the site until you add a visible item."
                      : "This section stays hidden on the site until you add a visible item."}
                </p>
                <div className="mt-3 flex flex-wrap justify-center gap-2">
                  <button
                    onClick={openAdd}
                    className="rounded-lg px-4 py-2 text-sm glass hover:bg-muted"
                  >
                    Add your first item
                  </button>
                  {showSeedImport && (
                    <button
                      onClick={handleSeedImport}
                      disabled={importingSeeds}
                      className="rounded-lg px-4 py-2 text-sm border border-border hover:bg-muted disabled:opacity-60"
                    >
                      {importingSeeds ? "Importing…" : "Import seeds"}
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <ul className="mt-4 space-y-2">
                {visibleItems.map((item, idx) => {
                  const readOnly =
                    typeof item.id === "string" && String(item.id).startsWith("seed");
                  return (
                    <li
                      key={String(item.id)}
                      className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-background/40 px-3 py-2.5"
                    >
                      <span className="font-mono text-xs text-muted-foreground w-8">
                        #{idx + 1}
                      </span>
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
                            aria-label={
                              confirmingId === String(item.id)
                                ? `Confirm delete ${item.title}`
                                : `Delete ${item.title}`
                            }
                            className={`rounded-md px-2 py-1 text-xs transition-colors ${
                              confirmingId === String(item.id)
                                ? "bg-red-500/20 text-red-200 hover:bg-red-500/30"
                                : "text-red-300 hover:bg-red-500/10"
                            }`}
                          >
                            {confirmingId === String(item.id) ? "Confirm?" : "Delete"}
                          </button>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}

            {showSeedImport && visibleItems.length > 0 && (
              <button
                onClick={handleSeedImport}
                disabled={importingSeeds}
                className="mt-3 rounded-lg px-4 py-2 text-sm border border-border hover:bg-muted disabled:opacity-60"
              >
                {importingSeeds ? "Importing…" : "Import seeds"}
              </button>
            )}

            {formOpen && activeKind && (
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
                      placeholder="Item title"
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
                      placeholder="Venue / tag / group sub-line"
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
                      placeholder="https://…"
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
                      placeholder="Body text…"
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
                      placeholder="stack / skills / chips"
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
                      placeholder="/… or https://…"
                      className="mt-1.5 w-full rounded-lg bg-background/60 border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                    />
                  </label>
                  <label className="block sm:col-span-2">
                    <span className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
                      Meta JSON (advanced)
                    </span>
                    <textarea
                      value={form.meta}
                      onChange={(e) => setForm({ ...form, meta: e.target.value })}
                      rows={3}
                      spellCheck={false}
                      className="mt-1.5 w-full rounded-lg bg-background/60 border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 resize-y font-mono"
                      placeholder='{"long": "…", "demo": "https://…"}'
                    />
                    <span className="mt-1 block font-mono text-[11px] text-muted-foreground">
                      {activeKind ? KIND_META_HELP[activeKind] : ""}
                    </span>
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
        )}

        <div className="mt-4 glass rounded-2xl p-4 sm:p-6">
          <h2 className="font-semibold">Change password</h2>
          <p className="mt-1 font-mono text-xs text-muted-foreground">
            Min 12 characters + a verified emailed code.{" "}
            {status && !status.db
              ? "Needs D1 in production — env fallback can't rotate here."
              : "Other sessions are signed out, and verification is reset."}
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
          Hidden items and hidden sections never render publicly. Research &amp; Blogs sections
          auto-hide when empty. Export JSON regularly as a backup; Import JSON restores it.
        </p>
      </div>
    </main>
  );
}
