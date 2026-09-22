import { Section } from "./Section";
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
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {items.map((c, i) => {
          const meta = c.meta ?? {};
          const Icon = (typeof meta.icon === "string" && ICONS[meta.icon]) || Shield;
          return (
            <div
              key={String(c.id)}
              className="reveal card-hover glass rounded-2xl p-5 hover:shadow-glow hover:-translate-y-1"
              style={{ transitionDelay: `${i * 60}ms` }}
            >
              <div className="grid place-items-center h-10 w-10 rounded-xl bg-gradient-to-br from-cyan/20 to-violet/20 border border-border">
                <Icon size={18} className="text-foreground" />
              </div>
              <h3 className="mt-4 font-semibold">{c.title}</h3>
              <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed">
                {c.description}
              </p>
            </div>
          );
        })}
      </div>
    </Section>
  );
}
