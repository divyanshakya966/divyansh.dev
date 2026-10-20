import { useEffect, useRef, useState } from "react";

const LINES = [
  { p: "$", t: "boot --user=divyansh" },
  { p: ">", t: "loading kernel modules..... [ok]" },
  { p: ">", t: "mounting /home/divyansh ...... [ok]" },
  { p: ">", t: "starting devsecops.service ... [ok]" },
  { p: ">", t: "auth: ssh-key verified ........ [ok]" },
  { p: "$", t: "./portfolio --launch" },
];

/*
 * Widths as pure utility classes, pixel-perfect 1/6 fractions.
 * Bars must NOT use inline styles here: hydrated SSR nodes can lose their
 * inline width, which renders `width: auto` (i.e. a full bar) at 0%.
 */
const BAR_WIDTHS = ["w-0", "w-1/6", "w-2/6", "w-3/6", "w-4/6", "w-5/6", "w-full"];

/** GRUB-style wait before the auto-boot fallback fires. */
const AUTO_BOOT_S = 8;

type Phase = "prompt" | "boot";

export function IntroBoot({
  onCloseStart,
  onDone,
}: {
  onCloseStart: () => void;
  onDone: () => void;
}) {
  const [phase, setPhase] = useState<Phase>("prompt");
  const [countdown, setCountdown] = useState(AUTO_BOOT_S);
  const [step, setStep] = useState(0);
  const [typed, setTyped] = useState("");
  const [done, setDone] = useState(false);
  const [closing, setClosing] = useState(false);
  // The finish timer outlives its scheduling effect run — track it so an
  // early unmount can't fire setState/callbacks on a dead tree.
  const finishTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(finishTimer.current), []);

  // Modifier combos and Tab fall through so browser/keyboard shortcuts never
  // get trapped by this screen.
  useEffect(() => {
    if (phase !== "prompt") return;
    // Fires inside the timeout callback — synchronously in the effect body
    // would cascade an extra render pass on every countdown tick.
    const t = setTimeout(() => {
      if (countdown <= 1) setPhase("boot");
      else setCountdown(countdown - 1);
    }, 1000);
    const start = () => setPhase("boot");
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || e.isComposing) return;
      if (e.key === "Tab" || /^F\d+$/.test(e.key)) return;
      e.preventDefault();
      start();
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", start);
    return () => {
      clearTimeout(t);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", start);
    };
  }, [phase, countdown]);

  useEffect(() => {
    if (phase !== "boot" || done) return;
    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (step >= LINES.length) {
      const t = setTimeout(
        () => {
          setClosing(true);
          onCloseStart();
          finishTimer.current = setTimeout(() => {
            setDone(true);
            onDone();
          }, 750);
        },
        reduced ? 0 : 200,
      );
      return () => {
        clearTimeout(t);
        clearTimeout(finishTimer.current);
      };
    }

    const line = LINES[step].t;
    if (typed.length < line.length) {
      // Reduced motion still steps through every line so the counter
      // ramps 0% → 100% instead of flashing to 100% on the first frame.
      const t = setTimeout(
        () => setTyped(reduced ? line : line.slice(0, typed.length + 1)),
        reduced ? 0 : 10 + Math.random() * 12,
      );
      return () => clearTimeout(t);
    }
    const t = setTimeout(
      () => {
        setStep((s) => s + 1);
        setTyped("");
      },
      reduced ? 25 : 80,
    );
    return () => clearTimeout(t);
  }, [phase, typed, step, done, onCloseStart, onDone]);

  if (done) return null;

  const pct = Math.min(100, Math.round((step / LINES.length) * 100));

  return (
    <div
      id="boot-screen"
      className={`fixed inset-0 z-[105] bg-background flex items-center justify-center transition-opacity duration-700 ${
        closing ? "opacity-0" : "opacity-100"
      }`}
      aria-hidden
    >
      <div className="absolute inset-0 scanlines-overlay opacity-40" />
      <div className="absolute inset-0 noise-overlay" />

      <div className="relative w-[min(640px,90vw)] font-mono text-[12px] sm:text-sm">
        <div className="flex items-center gap-2 mb-4 text-muted-foreground">
          <span className="h-2.5 w-2.5 rounded-full bg-foreground/30" />
          <span className="h-2.5 w-2.5 rounded-full bg-foreground/30" />
          <span className="h-2.5 w-2.5 rounded-full bg-foreground/30" />
          <span className="ml-3 text-[10px] uppercase tracking-[0.3em]">divyansh@arch — tty1</span>
        </div>

        {phase === "prompt" ? (
          <div className="border border-border/60 rounded-lg p-4 sm:p-6 bg-card/40 backdrop-blur-sm">
            <div className="text-foreground/40 mb-4 sm:mb-5">GNU GRUB version 2.12-divyansh</div>
            <div className="space-y-2.5">
              <div className="flex items-center gap-2 text-foreground">
                <span className="text-foreground/50">▸ [1]</span>
                <span>divyansh.dev — secure boot</span>
                <span className="ml-auto h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_oklch(0.85_0.15_160/0.9)]" />
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <span className="text-foreground/30 mr-[2px]">[2]</span>
                <span>memtest86+ — that would defeat the purpose</span>
              </div>
            </div>
            <div className="mt-5 sm:mt-6 border-t border-white/10 pt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
              <span className="text-foreground/90">
                press enter - or any key - to boot
                <span className="inline-block w-[7px] h-[13px] bg-foreground align-middle ml-2 animate-blink" />
              </span>
              <span className="ml-auto tabular-nums">auto boot in {countdown}s</span>
            </div>
          </div>
        ) : (
          <>
            <div className="border border-border/60 rounded-lg p-4 sm:p-5 bg-card/40 backdrop-blur-sm min-h-[220px]">
              {LINES.slice(0, step).map((l, i) => (
                <div key={i} className="text-foreground/80">
                  <span className="text-foreground/40 mr-2">{l.p}</span>
                  {l.t}
                </div>
              ))}
              {step < LINES.length && (
                <div className="text-foreground/90">
                  <span className="text-foreground/40 mr-2">{LINES[step].p}</span>
                  {typed}
                  <span className="inline-block w-[7px] h-[14px] bg-foreground align-middle ml-0.5 animate-blink" />
                </div>
              )}
            </div>

            <div className="mt-3 flex items-center justify-between text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
              <span>secure boot</span>
              <span className="tabular-nums">{pct}%</span>
            </div>
            {/* Rail starts empty and grows with the counter; width via utility
                class, never inline style (hydration note above). */}
            <div className="mt-1 h-px overflow-hidden">
              <div
                className={`h-full bg-foreground transition-[width] duration-200 ${BAR_WIDTHS[step] ?? "w-full"}`}
              />
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] text-muted-foreground/70">
              <span className="uppercase tracking-[0.3em]">shortcuts</span>
              <span>
                <kbd className="rounded border border-foreground/15 px-1 py-0.5">⌘K</kbd> search
              </span>
              <span>
                <kbd className="rounded border border-foreground/15 px-1 py-0.5">⌘`</kbd> terminal
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
