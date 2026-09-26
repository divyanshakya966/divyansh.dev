import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Section } from "./Section";
import { Reveal } from "./Reveal";
import { usePublicContent, useSiteSettings } from "@/hooks/use-content";
import { isSectionVisible } from "@/lib/settings";

export function Skills() {
  const { items } = usePublicContent("skill");
  const { settings } = useSiteSettings();
  const [active, setActive] = useState(0);

  if (!isSectionVisible(settings, "skills") || items.length === 0) return null;
  const ticker = [...new Set(items.flatMap((g) => g.tags))].slice(0, 24);
  const current = items[Math.min(active, items.length - 1)]!;

  return (
    <Section
      id="skills"
      eyebrow="02 / Skills"
      title={
        <>
          The toolkit, <span className="text-gradient">organized</span>.
        </>
      }
      description="A focused stack across web, systems and security."
    >
      {ticker.length > 0 && (
        <div
          aria-hidden="true"
          className="relative mb-6 overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_12%,black_88%,transparent)]"
        >
          <div className="flex w-max gap-2 animate-marquee hover:[animation-play-state:paused]">
            {[...ticker, ...ticker].map((t, i) => (
              <span
                key={`${t}-${i}`}
                className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-[11px] font-mono text-muted-foreground whitespace-nowrap"
              >
                <span className="h-1 w-1 rounded-full bg-white/70" />
                {t}
              </span>
            ))}
          </div>
        </div>
      )}
      <Reveal variant="up">
        <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.015]">
          <div className="flex items-center gap-2 border-b border-white/10 bg-white/[0.02] px-4 py-3">
            <span className="flex gap-1.5" aria-hidden="true">
              <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
              <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
              <span className="h-2.5 w-2.5 rounded-full bg-white/40" />
            </span>
            <span className="ml-2 truncate font-mono text-[11px] text-muted-foreground">
              {"~/ skills --group="}
              {current.title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}
            </span>
            <span className="ml-auto hidden sm:block font-mono text-[10px] text-muted-foreground/70">
              {items.length} groups · {current.tags.length} skills
            </span>
          </div>
          <div className="grid lg:grid-cols-[230px_1fr]">
            <div
              role="tablist"
              aria-label="Skill groups"
              className="flex lg:flex-col gap-1 overflow-x-auto border-b lg:border-b-0 lg:border-r border-white/10 p-2"
            >
              {items.map((g, gi) => {
                const selected = gi === Math.min(active, items.length - 1);
                return (
                  <button
                    key={String(g.id)}
                    role="tab"
                    aria-selected={selected}
                    onClick={() => setActive(gi)}
                    className={`group flex shrink-0 items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition-colors ${
                      selected
                        ? "bg-white/[0.06] text-foreground"
                        : "text-muted-foreground hover:bg-white/[0.03] hover:text-foreground"
                    }`}
                  >
                    <span
                      className={`font-mono text-[11px] tabular-nums ${
                        selected ? "text-foreground" : "text-white/30"
                      }`}
                    >
                      0{gi + 1}
                    </span>
                    <span className="whitespace-nowrap font-medium">{g.title}</span>
                    <span
                      className={`ml-auto h-1.5 w-1.5 rounded-full transition-colors ${
                        selected ? "bg-white" : "bg-white/20 group-hover:bg-white/40"
                      }`}
                    />
                  </button>
                );
              })}
            </div>
            <div className="min-h-[220px] p-5 sm:p-6">
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={String(current.id)}
                  role="tabpanel"
                  initial={{ opacity: 0, x: 14 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  transition={{ duration: 0.22, ease: "easeOut" }}
                >
                  <div className="font-mono text-[11px] text-muted-foreground">
                    <span className="text-foreground">$</span> ls ~/skills/
                    {current.title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}/
                  </div>
                  <ul className="mt-4 grid sm:grid-cols-2 gap-x-6">
                    {current.tags.map((s, si) => (
                      <li
                        key={s}
                        className="group flex items-center gap-2.5 border-b border-white/[0.06] py-2.5 font-mono text-[13px] text-muted-foreground transition-colors hover:border-white/20 hover:text-foreground"
                      >
                        <span className="text-white/30 transition-colors group-hover:text-white">
                          ▸
                        </span>
                        <span className="truncate">{s}</span>
                        <span className="ml-auto font-mono text-[10px] text-white/25 tabular-nums">
                          {String(si + 1).padStart(2, "0")}
                        </span>
                      </li>
                    ))}
                  </ul>
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </div>
      </Reveal>
    </Section>
  );
}
