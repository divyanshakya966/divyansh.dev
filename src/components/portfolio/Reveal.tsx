import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import type { ReactNode } from "react";

type RevealVariant = "up" | "left" | "right" | "scale" | "blur" | "clip";

const hiddenStates: Record<RevealVariant, Record<string, string | number>> = {
  up: { opacity: 0, y: 40 },
  left: { opacity: 0, x: -60 },
  right: { opacity: 0, x: 60 },
  scale: { opacity: 0, scale: 0.92 },
  blur: { opacity: 0, y: 20, filter: "blur(14px)" },
  clip: { opacity: 0, clipPath: "inset(0 100% 0 0)" },
};

const visibleStates: Record<RevealVariant, Record<string, string | number>> = {
  up: { opacity: 1, y: 0 },
  left: { opacity: 1, x: 0 },
  right: { opacity: 1, x: 0 },
  scale: { opacity: 1, scale: 1 },
  blur: { opacity: 1, y: 0, filter: "blur(0px)" },
  clip: { opacity: 1, clipPath: "inset(0 0% 0 0)" },
};

// Hysteresis band: entering takes 12% visibility, leaving takes dropping
// below 2%. A single shared threshold flickers when content rests exactly on
// the viewport edge (e.g. the contact section at page bottom, mobile browser
// chrome resizing) — the wide band means only genuine scroll-aways rewind.
const ENTER_RATIO = 0.12;
const EXIT_RATIO = 0.02;

export function Reveal({
  children,
  variant = "up",
  delay = 0,
  duration = 0.9,
  className,
}: {
  children: ReactNode;
  variant?: RevealVariant;
  delay?: number;
  duration?: number;
  className?: string;
}) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    if (reduce) return;
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      setShown(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.intersectionRatio >= ENTER_RATIO) setShown(true);
          else if (e.intersectionRatio <= EXIT_RATIO) setShown(false);
        }
      },
      {
        threshold: [0, EXIT_RATIO, ENTER_RATIO, 0.5, 1],
        // Expanded bottom edge: content resting near the page bottom
        // (contact + footer) counts as visible instead of straddling the line.
        rootMargin: "0px 0px 12% 0px",
      },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [reduce]);

  if (reduce) return <div className={className}>{children}</div>;

  return (
    <motion.div
      ref={ref}
      className={className}
      initial="hidden"
      animate={shown ? "visible" : "hidden"}
      variants={{ hidden: hiddenStates[variant], visible: visibleStates[variant] }}
      transition={{ duration, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}
