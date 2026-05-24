import { Section } from "./Section";
import { Award, Trophy, BadgeCheck, Star } from "lucide-react";

const items = [
  { icon: Trophy, title: "Top 1% — TryHackMe", sub: "Global ranking · ongoing" },
  { icon: Award, title: "2x National Hackathon Finalist", sub: "National level · 2025 / 2026" },
  { icon: BadgeCheck, title: "GSSoC 2026 Contributor", sub: "Open source · 2026" },
  { icon: Star, title: "Active Open Source Dev", sub: "GitHub @divyanshakya966" },
];

export function Achievements() {
  return (
    <Section
      id="achievements"
      eyebrow="05 / Achievements"
      title={<>Highlights & <span className="text-gradient">recognitions</span>.</>}
    >
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {items.map((it, i) => (
          <div
            key={it.title}
            className="reveal glass rounded-2xl p-5 hover:shadow-glow hover:-translate-y-1 transition-all"
            style={{ transitionDelay: `${i * 60}ms` }}
          >
            <div className="grid place-items-center h-10 w-10 rounded-xl bg-gradient-to-br from-cyan/20 to-violet/20 border border-border">
              <it.icon size={18} />
            </div>
            <div className="mt-4 font-semibold text-sm">{it.title}</div>
            <div className="text-xs text-muted-foreground mt-1">{it.sub}</div>
          </div>
        ))}
      </div>
    </Section>
  );
}
