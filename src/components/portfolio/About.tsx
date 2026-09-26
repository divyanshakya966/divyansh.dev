import { Section } from "./Section";
import { Reveal } from "./Reveal";
import { Shield, Cloud, Code2, Terminal, type LucideIcon } from "lucide-react";
import { usePublicContent, useSiteSettings } from "@/hooks/use-content";
import { isSectionVisible } from "@/lib/settings";

const ICONS: Record<string, LucideIcon> = {
  shield: Shield,
  cloud: Cloud,
  code: Code2,
  terminal: Terminal,
};

export function About() {
  const { items } = usePublicContent("about");
  const { settings } = useSiteSettings();

  if (!isSectionVisible(settings, "about") || items.length === 0) return null;
  const intro = settings.about_intro?.trim() || "";

  return (
    <Section
      id="about"
      eyebrow="01 / About"
      title={
        <>
          Aspiring security engineer building <span className="text-gradient">secure systems</span>.
        </>
      }
      description={intro || undefined}
    >
      <div className="border-t border-white/10">
        {items.map((c, i) => {
          const meta = c.meta ?? {};
          const Icon = (typeof meta.icon === "string" && ICONS[meta.icon]) || Shield;
          return (
            <Reveal key={String(c.id)} variant="up" delay={Math.min(i * 0.05, 0.2)}>
              <div className="group grid sm:grid-cols-[48px_1fr_1.5fr] gap-3 sm:gap-6 border-b border-white/10 px-2 sm:px-4 py-6 transition-colors duration-300 hover:bg-white/[0.03]">
                <span className="hidden sm:block font-mono text-xs text-white/25 tabular-nums pt-1">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <div className="flex sm:block items-center gap-3">
                  <span className="grid place-items-center h-10 w-10 rounded-xl border border-white/10 bg-white/[0.04] shrink-0 transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3">
                    <Icon size={18} className="text-foreground" />
                  </span>
                  <h3 className="sm:mt-3 font-semibold text-base sm:text-lg tracking-tight">
                    {c.title}
                  </h3>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed sm:pt-11 max-w-xl">
                  {c.description}
                </p>
              </div>
            </Reveal>
          );
        })}
      </div>
    </Section>
  );
}
