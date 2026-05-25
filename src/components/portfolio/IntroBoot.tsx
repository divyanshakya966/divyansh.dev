import { useEffect, useState } from "react";

const LINES = [
  { p: "$", t: "boot --user=divyansh" },
  { p: ">", t: "loading kernel modules..... [ok]" },
  { p: ">", t: "mounting /home/divyansh ...... [ok]" },
  { p: ">", t: "starting devsecops.service ... [ok]" },
  { p: ">", t: "auth: ssh-key verified ........ [ok]" },
  { p: "$", t: "./portfolio --launch" },
];

export function IntroBoot({ onCloseStart, onDone }: { onCloseStart: () => void; onDone: () => void }) {
  const [step, setStep] = useState(0);
  const [typed, setTyped] = useState("");
  const [done, setDone] = useState(false);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    if (done) return;
    if (step >= LINES.length) {
      const t = setTimeout(() => {
        setClosing(true);
        onCloseStart();
        setTimeout(() => {
          setDone(true);
          onDone();
        }, 700);
      }, 350);
      return () => clearTimeout(t);
    }
    const line = LINES[step].t;
    if (typed.length < line.length) {
      const t = setTimeout(() => setTyped(line.slice(0, typed.length + 1)), 18 + Math.random() * 22);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => {
      setStep((s) => s + 1);
      setTyped("");
    }, 180);
    return () => clearTimeout(t);
  }, [typed, step, done, onDone]);

  if (done) return null;

  return (
    <div
      className={`fixed inset-0 z-[80] bg-background flex items-center justify-center transition-opacity duration-700 ${
        closing ? "opacity-0" : "opacity-100"
      }`}
      aria-hidden
    >
      {/* scanlines + grain inside */}
      <div className="absolute inset-0 scanlines-overlay opacity-40" />
      <div className="absolute inset-0 noise-overlay" />

      <div className="relative w-[min(640px,90vw)] font-mono text-[12px] sm:text-sm">
        <div className="flex items-center gap-2 mb-4 text-muted-foreground">
          <span className="h-2.5 w-2.5 rounded-full bg-foreground/30" />
          <span className="h-2.5 w-2.5 rounded-full bg-foreground/30" />
          <span className="h-2.5 w-2.5 rounded-full bg-foreground/30" />
          <span className="ml-3 text-[10px] uppercase tracking-[0.3em]">divyansh@arch — tty1</span>
        </div>

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
          <span>{Math.min(100, Math.round((step / LINES.length) * 100))}%</span>
        </div>
        <div className="mt-1 h-px bg-foreground/10 overflow-hidden">
          <div
            className="h-full bg-foreground transition-[width] duration-200"
            style={{ width: `${(step / LINES.length) * 100}%` }}
          />
        </div>
      </div>
    </div>
  );
}
