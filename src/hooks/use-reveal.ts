import { useEffect } from "react";

/**
 * Modern scroll reveals with variants + stagger.
 * Usage:
 *   <div className="reveal" />                     -> default fade-up
 *   <div className="reveal" data-reveal="left" />  -> slide from left
 *   <div className="reveal" data-reveal="right" />
 *   <div className="reveal" data-reveal="scale" />
 *   <div className="reveal" data-reveal="blur" />
 *   <div className="reveal-stagger">               -> children .reveal animate with auto delay
 */
export function useReveal(enabled = true) {
  useEffect(() => {
    if (!enabled) return;

    // assign stagger delays
    document.querySelectorAll<HTMLElement>(".reveal-stagger").forEach((parent) => {
      const kids = parent.querySelectorAll<HTMLElement>(":scope > .reveal, :scope .reveal-child");
      kids.forEach((el, i) => {
        if (!el.style.transitionDelay) el.style.transitionDelay = `${i * 80}ms`;
      });
    });

    const els = document.querySelectorAll<HTMLElement>(".reveal, .reveal-child");
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("in");
            io.unobserve(e.target);
          }
        });
      },
      { threshold: 0.1, rootMargin: "0px 0px -60px 0px" }
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [enabled]);
}
