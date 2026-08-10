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

    // Once a reveal completes, drop the stagger delay so hover transitions stay snappy.
    const clearDelay = (el: HTMLElement) => {
      const onEnd = (e: TransitionEvent) => {
        if (e.target !== el || e.propertyName !== "opacity") return;
        el.style.transitionDelay = "0ms";
        el.removeEventListener("transitionend", onEnd);
      };
      el.addEventListener("transitionend", onEnd);
    };

    const els = document.querySelectorAll<HTMLElement>(".reveal, .reveal-child");
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("in");
            clearDelay(e.target as HTMLElement);
            io.unobserve(e.target);
          }
        });
      },
      { threshold: 0.1, rootMargin: "0px 0px -60px 0px" },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [enabled]);
}
