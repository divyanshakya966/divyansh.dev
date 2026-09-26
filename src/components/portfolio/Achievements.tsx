import { Section } from "./Section";
import { Reveal } from "./Reveal";
import { Award, Trophy, BadgeCheck, Star, type LucideIcon } from "lucide-react";
import { usePublicContent, useSiteSettings } from "@/hooks/use-content";
import { isSectionVisible } from "@/lib/settings";

const ICONS: Record<string, LucideIcon> = {
  trophy: Trophy,
  award: Award,
  badge: BadgeCheck,
  star: Star,
};

export function Achievements() {
  const { items } = usePublicContent("achievement");
  const { settings } = useSiteSettings();

  if (!isSectionVisible(settings, "achievements") || items.length === 0) return null;

  return (
    <Section
      id="achievements"
      eyebrow="06 / Achievements"
      title={
        <>
          Highlights & <span className="text-gradient">recognitions</span>.
        </>
      }
    >
      <div className="overflow-hidden rounded-2xl border-y border-white/10">
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 sm:divide-x divide-white/10 divide-y sm:divide-y-0">
          {items.map((it, i) => {
            const meta = it.meta ?? {};
            const Icon = (typeof meta.icon === "string" && ICONS[meta.icon]) || BadgeCheck;
            return (
              <Reveal key={String(it.id)} variant="up" delay={(i % 4) * 0.06}>
                <div className="group relative px-6 py-7 transition-colors duration-300 hover:bg-white/[0.03]">
                  <div className="flex items-start justify-between">
                    <span
                      aria-hidden="true"
                      className="font-mono text-xs text-white/25 tabular-nums"
                    >
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span className="grid place-items-center h-9 w-9 rounded-full border border-white/10 bg-white/[0.03] transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-6">
                      <Icon size={16} />
                    </span>
                  </div>
                  <div className="mt-6 font-semibold text-base leading-snug">{it.title}</div>
                  <div className="mt-1.5 font-mono text-xs text-muted-foreground leading-relaxed">
                    {it.subtitle}
                  </div>
                </div>
              </Reveal>
            );
          })}
        </div>
      </div>
    </Section>
  );
}
