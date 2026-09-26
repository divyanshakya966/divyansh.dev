import { useRef, type ReactNode } from "react";
import { motion, useReducedMotion, useScroll, useTransform } from "motion/react";
import { Reveal } from "./Reveal";

export function Section({
  id,
  eyebrow,
  title,
  description,
  children,
}: {
  id: string;
  eyebrow: string;
  title: ReactNode;
  description?: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLElement>(null);
  const reduce = useReducedMotion();
  // Scrubbed drift: the header floats against scroll direction and settles
  // back perfectly when scrolling up — layered under the Reveal entrances.
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const drift = useTransform(scrollYProgress, [0, 1], [30, -30]);

  return (
    <section ref={ref} id={id} className="relative py-24 sm:py-32 xl:py-36 2xl:py-48 scroll-mt-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <motion.div className="max-w-2xl mb-14" style={reduce ? undefined : { y: drift }}>
          <Reveal variant="up">
            <div className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground mb-3 flex items-center gap-3">
              <span className="inline-block h-px w-8 bg-foreground/40" />
              <span>{eyebrow}</span>
            </div>
          </Reveal>
          <Reveal variant="blur" delay={0.08}>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight leading-[1.15] pb-[0.08em]">
              {title}
            </h2>
          </Reveal>
          {description && (
            <Reveal variant="up" delay={0.16}>
              <p className="mt-4 text-base sm:text-lg text-muted-foreground">{description}</p>
            </Reveal>
          )}
        </motion.div>
        <div>{children}</div>
      </div>
    </section>
  );
}
