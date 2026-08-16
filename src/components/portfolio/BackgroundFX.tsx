import { useEffect, useRef } from "react";

/**
 * Terminal-themed background:
 *  - Canvas-based matrix rain (binary / hex glyphs)
 *  - Cursor-tracked soft aurora
 *  - Vignette + scanlines + film grain
 *  - Top scroll progress bar (segmented per section)
 *  No grid / squares.
 */
export function BackgroundFX() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const auroraRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const mqReduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const mqCoarse = window.matchMedia("(pointer: coarse)");
    if (mqReduced.matches || mqCoarse.matches) return;

    let raf = 0;
    let running = false;
    let drops: number[] = [];
    const fontSize = 14;
    const glyphs = "01░▒▓<>/$_{}[]=+*#01アァカサタナハマヤラワ".split("");

    const setup = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      canvas.style.width = window.innerWidth + "px";
      canvas.style.height = window.innerHeight + "px";
      ctx.scale(dpr, dpr);
      const cols = Math.ceil(window.innerWidth / fontSize);
      drops = Array.from({ length: cols }, () => Math.random() * -50);
    };
    setup();

    const draw = () => {
      // fade trail
      ctx.fillStyle = "rgba(8, 8, 10, 0.08)";
      ctx.fillRect(0, 0, window.innerWidth, window.innerHeight);

      ctx.font = `${fontSize}px JetBrains Mono, ui-monospace, monospace`;

      for (let i = 0; i < drops.length; i++) {
        const ch = glyphs[Math.floor(Math.random() * glyphs.length)];
        const x = i * fontSize;
        const y = drops[i] * fontSize;
        if (Math.random() > 0.975) ctx.fillStyle = "rgba(230, 230, 230, 0.85)";
        else ctx.fillStyle = `rgba(200, 200, 200, ${0.06 + Math.random() * 0.08})`;
        ctx.fillText(ch, x, y);

        if (y > window.innerHeight && Math.random() > 0.972) drops[i] = 0;
        drops[i] += 0.45 + Math.random() * 0.35;
      }
      raf = requestAnimationFrame(draw);
    };
    const start = () => {
      if (running) return;
      running = true;
      draw();
    };
    const stop = () => {
      running = false;
      cancelAnimationFrame(raf);
    };
    start();

    const onVisibility = () => (document.hidden ? stop() : start());
    document.addEventListener("visibilitychange", onVisibility);

    const onResize = () => setup();
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      document.removeEventListener("visibilitychange", onVisibility);
      stop();
    };
  }, []);

  useEffect(() => {
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const y = window.scrollY;
        const max = document.documentElement.scrollHeight - window.innerHeight;
        const p = max > 0 ? y / max : 0;
        if (progressRef.current) progressRef.current.style.transform = `scaleX(${p})`;
      });
    };
    const onMove = (e: MouseEvent) => {
      if (!auroraRef.current) return;
      const x = (e.clientX / window.innerWidth) * 100;
      const y = (e.clientY / window.innerHeight) * 100;
      auroraRef.current.style.background = `radial-gradient(700px circle at ${x}% ${y}%, oklch(0.97 0 0 / 0.07), transparent 60%)`;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("mousemove", onMove, { passive: true });
    onScroll();
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("mousemove", onMove);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <>
      <div className="fixed top-0 inset-x-0 h-px z-[60] pointer-events-none bg-foreground/5">
        <div
          ref={progressRef}
          className="h-full origin-left bg-foreground"
          style={{ transform: "scaleX(0)" }}
        />
      </div>

      <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
        <canvas ref={canvasRef} className="matrix-rain absolute inset-0 opacity-[0.55]" />
        <div ref={auroraRef} className="absolute inset-0" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_25%,var(--background)_92%)]" />
        <div className="absolute inset-0 portfolio-light-vignette" />
        <div className="absolute inset-0 noise-overlay" />
        <div className="absolute inset-0 scanlines-overlay" />
      </div>
    </>
  );
}
