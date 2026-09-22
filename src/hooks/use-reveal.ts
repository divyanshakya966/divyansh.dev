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
 *
 * Dynamic-safe: portfolio cards remount when server data arrives (seed keys
 * swap for database ids) and sections appear/disappear from admin edits. A
 * MutationObserver picks up every late-mounted .reveal node so nothing stays
 * invisible — the original mount-only version stranded them at opacity 0.
 */
const SELECTOR = ".reveal, .reveal-child";

export function useReveal(enabled = true) {
  useEffect(() => {
    if (!enabled) return;

    // Once a reveal completes, drop the stagger delay so hover transitions stay snappy.
    const clearDelay = (el: HTMLElement) => {
      const onEnd = (e: TransitionEvent) => {
        if (e.target !== el || e.propertyName !== "opacity") return;
        el.style.transitionDelay = "0ms";
        el.removeEventListener("transitionend", onEnd);
      };
      el.addEventListener("transitionend", onEnd);
    };

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

    const staggerize = (parent: Element) => {
      const kids = parent.querySelectorAll<HTMLElement>(":scope > .reveal, :scope .reveal-child");
      kids.forEach((el, i) => {
        if (!el.style.transitionDelay) el.style.transitionDelay = `${i * 80}ms`;
      });
    };

    const observe = (el: HTMLElement) => {
      if (el.dataset.revealObserved === "1" || el.classList.contains("in")) return;
      el.dataset.revealObserved = "1";
      const staggerParent = el.closest(".reveal-stagger");
      if (staggerParent) staggerize(staggerParent);
      io.observe(el);
    };

    const collect = (root: ParentNode) => {
      root.querySelectorAll<HTMLElement>(SELECTOR).forEach(observe);
    };

    document.querySelectorAll<HTMLElement>(".reveal-stagger").forEach(staggerize);
    collect(document);

    const mo = new MutationObserver((mutations) => {
      for (const m of mutations) {
        m.addedNodes.forEach((node) => {
          if (!(node instanceof Element)) return;
          if (node.matches(SELECTOR)) observe(node as HTMLElement);
          collect(node);
          if (node.matches(".reveal-stagger")) staggerize(node);
          node.querySelectorAll(".reveal-stagger").forEach((p) => staggerize(p));
        });
      }
    });
    mo.observe(document.body, { childList: true, subtree: true });

    return () => {
      io.disconnect();
      mo.disconnect();
    };
  }, [enabled]);
}
