import { useEffect, useState } from "react";
import { motion, useMotionValue, useSpring } from "motion/react";

type HoverKind = "default" | "link" | "hidden";

/**
 * Simple premium cursor — single pointer, no trailer.
 * - Ultra-snappy spring (no float/slip)
 * - Fills on interactive hover, presses on click
 * - One-shot click ripple for feedback
 * Disabled on touch / coarse pointers / reduced motion.
 */
export function Cursor() {
  const [enabled, setEnabled] = useState(false);
  const [hover, setHover] = useState<HoverKind>("default");
  const [pressed, setPressed] = useState(false);
  const [ripples, setRipples] = useState<{ id: number; x: number; y: number }[]>([]);

  const mx = useMotionValue(-100);
  const my = useMotionValue(-100);
  // Snappy: high stiffness + high damping = tracks almost 1:1 with slight smoothing.
  const sx = useSpring(mx, { stiffness: 1400, damping: 90, mass: 0.25 });
  const sy = useSpring(my, { stiffness: 1400, damping: 90, mass: 0.25 });

  useEffect(() => {
    if (typeof window === "undefined") return;
    const fine = window.matchMedia("(pointer: fine)").matches;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!fine || reduced) return;
    setEnabled(true);

    mx.set(window.innerWidth / 2);
    my.set(window.innerHeight / 2);

    const onMove = (e: MouseEvent) => {
      mx.set(e.clientX);
      my.set(e.clientY);
    };
    const onOver = (e: MouseEvent) => {
      const t = e.target as HTMLElement | null;
      if (!t || typeof t.closest !== "function") return;
      if (t.closest("input, textarea, select, [contenteditable]")) {
        setHover("hidden");
      } else if (t.closest('a, button, [role="button"], [data-cursor="view"]')) {
        setHover("link");
      } else {
        setHover("default");
      }
    };
    const onDown = (e: MouseEvent) => {
      setPressed(true);
      const id = Date.now() + Math.random();
      setRipples((r) => [...r.slice(-4), { id, x: e.clientX, y: e.clientY }]);
      window.setTimeout(() => {
        setRipples((r) => r.filter((x) => x.id !== id));
      }, 450);
    };
    const onUp = () => setPressed(false);

    window.addEventListener("mousemove", onMove, { passive: true });
    window.addEventListener("mouseover", onOver, { passive: true });
    window.addEventListener("mousedown", onDown);
    window.addEventListener("mouseup", onUp);
    document.documentElement.classList.add("custom-cursor");
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseover", onOver);
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("mouseup", onUp);
      document.documentElement.classList.remove("custom-cursor");
    };
  }, [mx, my]);

  if (!enabled) return null;

  const scale = pressed ? 0.88 : hover === "link" ? 1.28 : 1;
  const hidden = hover === "hidden";

  return (
    <>
      {/* click ripples — one-shot, no persistent trailer */}
      {ripples.map((r) => (
        <motion.span
          key={r.id}
          aria-hidden="true"
          className="fixed top-0 left-0 z-[100] pointer-events-none rounded-full border border-white/50"
          style={{ x: r.x, y: r.y }}
          initial={{ opacity: 0.7, scale: 0.25, width: 18, height: 18 }}
          animate={{ opacity: 0, scale: 1.6 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
        >
          <span className="-translate-x-1/2 -translate-y-1/2 block w-full h-full" />
        </motion.span>
      ))}

      <motion.div
        className="portfolio-cursor-pointer fixed top-0 left-0 z-[101] pointer-events-none"
        aria-hidden="true"
        style={{ x: sx, y: sy, opacity: hidden ? 0 : 1 }}
        animate={{ scale }}
        transition={{ type: "spring", stiffness: 900, damping: 35, mass: 0.3 }}
      >
        <svg
          viewBox="0 0 28 28"
          className="block h-full w-full"
          fill={hover === "link" ? "currentColor" : "none"}
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M5 3L22 16L13.5 17.5L9 25L5 3Z"
            className="portfolio-cursor-path"
            stroke="currentColor"
            strokeWidth={hover === "link" ? 1.4 : 1.7}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          {/* tip glint */}
          <circle cx="5.6" cy="4.2" r="1.4" fill="currentColor" opacity="0.9" />
        </svg>
      </motion.div>
    </>
  );
}
