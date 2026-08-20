import { Section } from "./Section";
import { Activity, BookOpen, Hammer } from "lucide-react";

export function Building() {
  return (
    <Section
      id="building"
      eyebrow="06 / Status"
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
          <h3 className="mt-4 font-semibold">Building</h3>
          <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
            AegisStack — a DevSecOps assistant that shifts security left across the developer
            pipeline.
          </p>
        </div>

        <div className="reveal glass rounded-2xl p-6 [transition-delay:80ms]">
          <BookOpen size={18} className="text-violet" />
          <h3 className="mt-4 font-semibold">Learning</h3>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            <li className="flex items-center gap-2">
              <span className="h-1 w-1 rounded-full bg-violet" /> DevSecOps & pipeline security
            </li>
            <li className="flex items-center gap-2">
              <span className="h-1 w-1 rounded-full bg-violet" /> Kubernetes & container hardening
            </li>
            <li className="flex items-center gap-2">
              <span className="h-1 w-1 rounded-full bg-violet" /> AI & cloud security fundamentals
            </li>
          </ul>
        </div>

        <div className="reveal glass rounded-2xl p-6 [transition-delay:160ms]">
          <Activity size={18} className="text-blue" />
          <h3 className="mt-4 font-semibold">Right now</h3>
          <div className="mt-4 space-y-3">
            {[
              { l: "TryHackMe rank", v: "Top 1%" },
              { l: "Open Source", v: "Contributor" },
              { l: "Hackathon finals", v: "2x" },
            ].map((s) => (
              <div key={s.l} className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{s.l}</span>
                <span className="font-mono">{s.v}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Section>
  );
}
