import { useEffect, useRef, useState } from "react";

/**
 * Custom themed cursor:
 *  - outlined pointer that matches the terminal-style cursor
 * Disabled on touch / coarse pointer devices.
 */
export function Cursor() {
  const pointerRef = useRef<HTMLDivElement>(null);
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const fine = window.matchMedia("(pointer: fine)").matches;
    if (!fine) return;
    setEnabled(true);

    let mx = window.innerWidth / 2;
    let my = window.innerHeight / 2;

    const onMove = (e: MouseEvent) => {
      mx = e.clientX;
      my = e.clientY;
      if (pointerRef.current) {
        pointerRef.current.style.transform = `translate3d(${mx - 5}px, ${my - 3}px, 0)`;
      }
    };

    window.addEventListener("mousemove", onMove, { passive: true });

    document.documentElement.classList.add("custom-cursor");
    return () => {
      window.removeEventListener("mousemove", onMove);
      document.documentElement.classList.remove("custom-cursor");
    };
  }, []);

  if (!enabled) return null;

  return (
    <>
      <div
        ref={pointerRef}
        className="portfolio-cursor-pointer fixed top-0 left-0 z-[101] pointer-events-none"
        aria-hidden="true"
      >
        <svg
          viewBox="0 0 28 28"
          className="block h-full w-full"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M5 3L22 16L13.5 17.5L9 25L5 3Z"
            className="portfolio-cursor-path"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        </svg>
      </div>
    </>
  );
}
