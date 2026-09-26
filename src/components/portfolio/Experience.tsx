import { useRef } from "react";
import { motion, useReducedMotion, useScroll, useSpring } from "motion/react";
import { Section } from "./Section";
import { Reveal } from "./Reveal";
import { usePublicContent, useSiteSettings } from "@/hooks/use-content";
import { isSectionVisible } from "@/lib/settings";

export function Experience() {
  const { items } = usePublicContent("experience");
  const { settings } = useSiteSettings();
  const trackRef = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  // Scrubbed rail: the line draws itself as you scroll down the journey
  // and undraws as you scroll back up.
  const { scrollYProgress } = useScroll({
    target: trackRef,
    offset: ["start 0.75", "end 0.55"],
  });
  const fill = useSpring(scrollYProgress, { stiffness: 110, damping: 26, mass: 0.4 });

  if (!isSectionVisible(settings, "experience") || items.length === 0) return null;

  return (
    <Section
      id="experience"
      eyebrow="04 / Experience"
      title={
        <>
          Training, <span className="text-gradient">open source</span> & hackathons.
        </>
      }
    >
      <div ref={trackRef} className="relative">
        <div className="absolute left-4 sm:left-1/2 sm:-translate-x-px top-0 bottom-0 w-px bg-gradient-to-b from-transparent via-white/20 to-transparent" />
        {!reduce && (
          <motion.div
            aria-hidden="true"
            style={{ scaleY: fill }}
            className="absolute left-4 sm:left-1/2 sm:-translate-x-px top-0 bottom-0 w-px origin-top bg-white/80 shadow-[0_0_12px_oklch(0.97_0_0/0.7)]"
          />
        )}
        <ul className="space-y-8">
          {items.map((it, i) => {
            const meta = it.meta ?? {};
            const when =
              typeof meta.when === "string" && meta.when.trim() ? meta.when : it.subtitle;
            const tag =
              typeof meta.tag === "string" && meta.tag.trim()
                ? meta.tag
                : (it.tags[0] ?? it.subtitle);
            return (
              <Reveal key={String(it.id)} variant={i % 2 === 0 ? "left" : "right"} delay={0}>
                <li className="group relative grid sm:grid-cols-2 gap-6 sm:gap-12 rounded-2xl p-2 -m-2 transition-colors hover:bg-white/[0.02]">
                  <div
                    className={`pl-12 sm:pl-0 ${
                      i % 2 === 0 ? "sm:order-1 sm:text-right sm:pr-12" : "sm:order-2 sm:pl-12"
                    }`}
                  >
                    <div className="absolute left-4 sm:left-1/2 -translate-x-1/2 top-4 h-3 w-3 rounded-full bg-white ring-4 ring-background shadow-[0_0_16px_oklch(0.97_0_0/0.6)] transition-transform duration-300 group-hover:scale-125" />
                    <div className="font-mono text-xs text-muted-foreground">
                      {when} · {tag}
                    </div>
                    <h3 className="mt-1 text-lg font-semibold group-hover:text-white transition-colors">
                      {it.title}
                    </h3>
                    <div className="text-sm text-muted-foreground">{it.subtitle}</div>
                  </div>
                  <div
                    className={`pl-12 sm:pl-0 ${
                      i % 2 === 0 ? "sm:order-2 sm:pl-12" : "sm:order-1 sm:text-right sm:pr-12"
                    }`}
                  >
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {it.description}
                    </p>
                  </div>
                </li>
              </Reveal>
            );
          })}
        </ul>
      </div>
    </Section>
  );
}
