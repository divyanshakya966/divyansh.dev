import { useEffect, useState } from "react";
import { SEED_CERTIFICATIONS, type ContentItem, type ContentKind } from "@/lib/content";

type State = { items: ContentItem[]; loading: boolean };

/**
 * Public content hook. Certifications render seeds immediately (SEO + no
 * empty flash); research/blogs start empty and stay hidden until the API
 * returns at least one visible item.
 */
export function usePublicContent(kind: ContentKind): State {
  const [items, setItems] = useState<ContentItem[]>(
    kind === "certification" ? SEED_CERTIFICATIONS : [],
  );
  const [loading, setLoading] = useState(kind !== "certification");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch(`/api/content?kind=${kind}`, { credentials: "same-origin" });
        if (!res.ok) return;
        const data = (await res.json()) as { items?: ContentItem[] };
        if (!cancelled && Array.isArray(data.items) && data.items.length > 0) {
          setItems(data.items);
        } else if (!cancelled && kind === "certification" && Array.isArray(data.items)) {
          // D1 is source of truth when it has rows; empty means admin hid all.
          if (data.items.length === 0) setItems([]);
          else setItems(data.items);
        }
      } catch {
        // Keep seeds / empty state on network failure.
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [kind]);

  return { items, loading };
}
