import { useEffect, useState } from "react";

function formatIST(d: Date): string {
  // Manual UTC+5:30 math — no Intl timeZone dependency (works in workers/tests,
  // ticks visibly every second instead of appearing stuck on minute boundaries).
  const utc = d.getTime() + d.getTimezoneOffset() * 60000;
  const ist = new Date(utc + 5.5 * 3600000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(ist.getHours())}:${pad(ist.getMinutes())}:${pad(ist.getSeconds())} IST`;
}

/** Live IST clock — ticks every second so the UI feels alive. SSR-safe. */
export function useISTClock(): string {
  const [now, setNow] = useState(() => {
    try {
      return formatIST(new Date());
    } catch {
      return "--:--:-- IST";
    }
  });

  useEffect(() => {
    const tick = () => {
      try {
        setNow(formatIST(new Date()));
      } catch {
        // ignore clock failures — stale time is better than a crash
      }
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, []);

  return now;
}
