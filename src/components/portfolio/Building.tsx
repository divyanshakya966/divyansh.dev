import { Section } from "./Section";
import { Activity, BookOpen, Hammer } from "lucide-react";
import { usePublicContent, useSiteSettings } from "@/hooks/use-content";
import { isSectionVisible } from "@/lib/settings";
import type { ContentItem } from "@/lib/content";

function linesOf(item: ContentItem): string[] {
  const raw = (item.meta ?? {}).lines;
  if (!Array.isArray(raw)) return [];
  return raw.filter((l): l is string => typeof l === "string").slice(0, 12);
}

function statsOf(item: ContentItem): { l: string; v: string }[] {
  const raw = (item.meta ?? {}).stats;
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(
      (s): s is { l: unknown; v: unknown } => !!s && typeof s === "object" && "l" in s && "v" in s,
    )
    .map((s) => ({ l: String(s.l), v: String(s.v) }))
    .slice(0, 12);
}

export function Building() {
  const { items } = usePublicContent("building");
  const { settings } = useSiteSettings();

  if (!isSectionVisible(settings, "building") || items.length === 0) return null;
  const build = items.find((i) => (i.meta ?? {}).card === "build") ?? items[0]!;
  const learn = items.find((i) => (i.meta ?? {}).card === "learn");
  const now = items.find((i) => (i.meta ?? {}).card === "now");

  return (
    <Section
      id="building"
      eyebrow="07 / Status"
      title={
        <>
          Currently <span className="text-gradient">building</span>.
        </>
      }
      description="A live snapshot of what I'm learning and shipping right now."
    >
      <div className="grid md:grid-cols-3 gap-4">
        <div className="reveal glass rounded-2xl p-6 relative overflow-hidden">
          <div className="absolute top-4 right-4 flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full rounded-full bg-cyan opacity-75 animate-ping" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-cyan" />
            </span>
            Live
          </div>
          <Hammer size={18} className="text-cyan" />
          <h3 className="mt-4 font-semibold">{build.title}</h3>
          <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{build.description}</p>
        </div>

        {learn ? (
          <div className="reveal glass rounded-2xl p-6 [transition-delay:80ms]">
            <BookOpen size={18} className="text-violet" />
            <h3 className="mt-4 font-semibold">{learn.title}</h3>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              {linesOf(learn).map((line) => (
                <li key={line} className="flex items-center gap-2">
                  <span className="h-1 w-1 rounded-full bg-violet" /> {line}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {now ? (
          <div className="reveal glass rounded-2xl p-6 [transition-delay:160ms]">
            <Activity size={18} className="text-blue" />
            <h3 className="mt-4 font-semibold">{now.title}</h3>
            <div className="mt-4 space-y-3">
              {statsOf(now).map((s) => (
                <div key={s.l} className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{s.l}</span>
                  <span className="font-mono">{s.v}</span>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </Section>
  );
}
