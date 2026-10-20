import { useEffect, useState } from "react";
import { motion, useMotionValue, useSpring } from "motion/react";
import { shapeFromElement, type CursorShape } from "@/lib/cursor";

type HoverKind = "default" | "link" | "hidden";

/**
 * Simple premium cursor — single pointer, no trailer.
 * - Ultra-snappy spring (no float/slip)
 * - Fills on interactive hover, presses on click
 * - Morphs into OS resize / grab arrows via `[data-cursor]` on the hovered node
 * - One-shot click ripple for feedback
 * Disabled on touch / coarse pointers / reduced motion.
 */
export function Cursor() {
  const [enabled, setEnabled] = useState(false);
  const [hover, setHover] = useState<HoverKind>("default");
  const [shape, setShape] = useState<CursorShape>("arrow");
  const [pressed, setPressed] = useState(false);
  const [ripples, setRipples] = useState<{ id: number; x: number; y: number }[]>([]);

  const mx = useMotionValue(-100);
  const my = useMotionValue(-100);
  // Near-critical damping: tracks ~1:1, never lags behind the OS cursor.
  const sx = useSpring(mx, { stiffness: 2600, damping: 60, mass: 0.12 });
  const sy = useSpring(my, { stiffness: 2600, damping: 60, mass: 0.12 });

  useEffect(() => {
    if (typeof window === "undefined") return;
    const fine = window.matchMedia("(pointer: fine)").matches;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!fine || reduced) return;
    setEnabled(true);

    mx.set(window.innerWidth / 2);
    my.set(window.innerHeight / 2);

    const setPos = (x: number, y: number) => {
      mx.set(x);
      my.set(y);
    };
    const evaluate = (t: HTMLElement | null) => {
      if (!t || typeof t.closest !== "function") return;
      const nextShape = shapeFromElement(t);
      setShape(nextShape ?? "arrow");
      if (nextShape) {
        setHover("default");
        return;
      }
      if (t.closest("input, textarea, select, [contenteditable]")) {
        setHover("hidden");
      } else if (t.closest('a, button, [role="button"], [data-cursor="view"]')) {
        setHover("link");
      } else {
        setHover("default");
      }
    };
    const onMouseMove = (e: MouseEvent) => {
      setPos(e.clientX, e.clientY);
      // Keep the shape in sync while the pointer moves (over the same node).
      if (!(e.target as HTMLElement)?.closest?.("[data-cursor]")) return;
      evaluate(e.target as HTMLElement);
    };
    // Pointer events fire during window drags/resizes even if mouse events stall.
    const onPointerMove = (e: PointerEvent) => setPos(e.clientX, e.clientY);
    const onOver = (e: MouseEvent) => evaluate(e.target as HTMLElement);
    // A drag/resize forces a cursor shape regardless of what's underneath.
    const onForce = (e: Event) => {
      const shape = (e as CustomEvent<CursorShape | null>).detail;
      setShape(shape ?? "arrow");
      setHover("default");
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

    window.addEventListener("mousemove", onMouseMove, { passive: true });
    window.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener("mouseover", onOver, { passive: true });
    window.addEventListener("mousedown", onDown);
    window.addEventListener("mouseup", onUp);
    window.addEventListener("cursor-force", onForce);
    document.documentElement.classList.add("custom-cursor");
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("mouseover", onOver);
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("mouseup", onUp);
      window.removeEventListener("cursor-force", onForce);
      document.documentElement.classList.remove("custom-cursor");
    };
  }, [mx, my]);

  if (!enabled) return null;

  const isResize = shape !== "arrow";
  const scale = pressed ? 0.88 : hover === "link" && !isResize ? 1.28 : 1;
  const hidden = hover === "hidden";

  return (
    <>
      {ripples.map((r) => (
        <motion.span
          key={r.id}
          aria-hidden="true"
          className="fixed top-0 left-0 z-[130] pointer-events-none rounded-full border border-white/50"
          style={{ x: r.x, y: r.y }}
          initial={{ opacity: 0.7, scale: 0.25, width: 18, height: 18 }}
          animate={{ opacity: 0, scale: 1.6 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
        >
          <span className="-translate-x-1/2 -translate-y-1/2 block w-full h-full" />
        </motion.span>
      ))}

      <motion.div
        className="portfolio-cursor-pointer fixed top-0 left-0 z-[131] pointer-events-none"
        aria-hidden="true"
        style={{ x: sx, y: sy, opacity: hidden ? 0 : 1 }}
        animate={{ scale }}
        transition={{ type: "spring", stiffness: 900, damping: 35, mass: 0.3 }}
      >
        <ShapeGlyph shape={shape} link={hover === "link"} />
      </motion.div>
    </>
  );
}

function ShapeGlyph({ shape, link }: { shape: CursorShape; link: boolean }) {
  if (shape !== "arrow") {
    // OS resize / grab arrows, centered so they sit under the pointer hotspot.
    const rotate =
      shape === "ns" ? 0 : shape === "ew" ? 90 : shape === "nesw" ? 45 : shape === "nwse" ? -45 : 0;
    if (shape === "grabbing") {
      return (
        <svg
          viewBox="0 0 28 28"
          className="block h-full w-full -translate-x-1/2 -translate-y-1/2"
          fill="currentColor"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path d="M10 13V6.5a1.6 1.6 0 0 1 3.2 0V12h.6V5.2a1.6 1.6 0 0 1 3.2 0V12h.6V7a1.6 1.6 0 0 1 3.2 0v8.2c0 3.7-2.3 6.3-6 6.3-2.4 0-4.2-1-5.4-2.8L6.9 15a1.6 1.6 0 0 1 2.6-1.9L10 14z" />
        </svg>
      );
    }
    return (
      <svg
        viewBox="0 0 28 28"
        className="block h-full w-full"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
        // Single translate hotspot: the Tailwind -translate classes set the
        // CSS `translate` property, which composes with `transform` — using
        // both shifted the glyph by its full width off the pointer.
        style={{ transform: `translate(-50%, -50%) rotate(${rotate}deg)` }}
        xmlns="http://www.w3.org/2000/svg"
      >
        <path d="M14 3v22" />
        <path d="M10 7l4-4 4 4" />
        <path d="M10 21l4 4 4-4" />
      </svg>
    );
  }
  return (
    <svg
      viewBox="0 0 28 28"
      className="block h-full w-full"
      fill={link ? "currentColor" : "none"}
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M5 3L22 16L13.5 17.5L9 25L5 3Z"
        className="portfolio-cursor-path"
        stroke="currentColor"
        strokeWidth={link ? 1.4 : 1.7}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <circle cx="5.6" cy="4.2" r="1.4" fill="currentColor" opacity="0.9" />
    </svg>
  );
}
