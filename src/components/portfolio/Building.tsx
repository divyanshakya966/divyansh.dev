import { Section } from "./Section";
import { Reveal } from "./Reveal";
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
      <Reveal variant="up">
        <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.015]">
          <div className="flex items-center gap-2 border-b border-white/10 bg-white/[0.02] px-4 py-3">
            <span className="flex gap-1.5" aria-hidden="true">
              <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
              <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
              <span className="h-2.5 w-2.5 rounded-full bg-white/40" />
            </span>
            <span className="ml-2 font-mono text-[11px] text-muted-foreground">
              ~/ status --live
            </span>
            <span className="ml-auto flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full rounded-full bg-white opacity-75 animate-ping" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-white" />
              </span>
              Live
            </span>
          </div>
          <div className="grid md:grid-cols-3 md:divide-x divide-white/10 divide-y md:divide-y-0">
            <div className="group p-6 transition-colors hover:bg-white/[0.02]">
              <Hammer
                size={18}
                className="text-foreground transition-transform duration-300 group-hover:rotate-12"
              />
              <h3 className="mt-4 font-semibold">{build.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                {build.description}
              </p>
            </div>

            {learn ? (
              <div className="group p-6 transition-colors hover:bg-white/[0.02]">
                <BookOpen
                  size={18}
                  className="text-foreground transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-110"
                />
                <h3 className="mt-4 font-semibold">{learn.title}</h3>
                <ul className="mt-3 space-y-0 text-sm text-muted-foreground">
                  {linesOf(learn).map((line) => (
                    <li
                      key={line}
                      className="flex items-center gap-2 border-b border-white/[0.06] py-2 last:border-b-0"
                    >
                      <span className="font-mono text-white/30">▸</span> {line}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {now ? (
              <div className="group p-6 transition-colors hover:bg-white/[0.02]">
                <Activity
                  size={18}
                  className="text-foreground transition-transform duration-300 group-hover:scale-110"
                />
                <h3 className="mt-4 font-semibold">{now.title}</h3>
                <div className="mt-4 space-y-0">
                  {statsOf(now).map((s) => (
                    <div
                      key={s.l}
                      className="flex items-baseline gap-2 border-b border-white/[0.06] py-2.5 text-sm last:border-b-0"
                    >
                      <span className="text-muted-foreground">{s.l}</span>
                      <span
                        aria-hidden="true"
                        className="mx-1 flex-1 border-b border-dotted border-white/15"
                      />
                      <span className="font-mono text-foreground">{s.v}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </Reveal>
    </Section>
  );
}
