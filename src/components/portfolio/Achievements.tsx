import { Section } from "./Section";
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
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {items.map((it, i) => {
          const meta = it.meta ?? {};
          const Icon = (typeof meta.icon === "string" && ICONS[meta.icon]) || BadgeCheck;
          return (
            <div
              key={String(it.id)}
              className="reveal card-hover glass rounded-2xl p-5 hover:shadow-glow hover:-translate-y-1"
              style={{ transitionDelay: `${i * 60}ms` }}
            >
              <div className="grid place-items-center h-10 w-10 rounded-xl bg-gradient-to-br from-cyan/20 to-violet/20 border border-border">
                <Icon size={18} />
              </div>
              <div className="mt-4 font-semibold text-sm">{it.title}</div>
              <div className="text-xs text-muted-foreground mt-1">{it.subtitle}</div>
            </div>
          );
        })}
      </div>
    </Section>
  );
}
