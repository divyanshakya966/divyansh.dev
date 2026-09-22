import { useEffect, useState } from "react";
import { SEEDS, type ContentItem, type ContentKind } from "@/lib/content";
import { DEFAULT_SETTINGS } from "@/lib/settings";

type ContentState = { items: ContentItem[]; loading: boolean };

/**
 * Public content hook. Renders seeds synchronously (SEO + no empty flash),
 * then replaces with the API result — the server already folds seeds in
 * when D1 is empty for the kind, so the client just trusts the response.
 */
export function usePublicContent(kind: ContentKind): ContentState {
  const [items, setItems] = useState<ContentItem[]>(SEEDS[kind]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch(`/api/content?kind=${kind}`, { credentials: "same-origin" });
        if (!res.ok) return;
        const data = (await res.json()) as { items?: ContentItem[]; source?: string };
        if (!cancelled && Array.isArray(data.items)) {
          // Never blank visible content on an ambiguous empty answer: only
          // adopt [] when the server confirms it owns the kind (source db —
          // i.e. the admin deliberately hid everything). Seed/empty sources
          // with [] mean "nothing to show", which matches what we render.
          if (data.items.length > 0 || data.source === "db" || items.length === 0) {
            setItems(data.items);
          }
        }
      } catch {
        // Keep seeds on network failure.
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
    // items.length is read once for the initial guard; the fetch replaces it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind]);

  return { items, loading };
}

type SettingsState = { settings: Record<string, string>; loading: boolean };

/** Site settings with synchronous defaults (SSR/test safe). */
export function useSiteSettings(): SettingsState {
  const [settings, setSettings] = useState<Record<string, string>>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch("/api/settings", { credentials: "same-origin" });
        if (!res.ok) return;
        const data = (await res.json()) as { settings?: Record<string, string> };
        if (!cancelled && data.settings && typeof data.settings === "object") {
          setSettings((prev) => ({ ...prev, ...data.settings }));
        }
      } catch {
        // Keep defaults on network failure.
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  return { settings, loading };
}
