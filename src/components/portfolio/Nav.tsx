import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowUpRight, Menu, X } from "lucide-react";

const baseLinks = [
  { href: "#about", label: "About", section: "about" },
  { href: "#skills", label: "Skills", section: "skills" },
  { href: "#projects", label: "Projects", section: "projects" },
  { href: "#experience", label: "Experience", section: "experience" },
  { href: "#certifications", label: "Certifications", section: "certifications" },
  { href: "#achievements", label: "Achievements", section: "achievements" },
  { href: "#building", label: "Building", section: "building" },
  { href: "#contact", label: "Contact", section: "contact" },
];

const TERMS = ["techie", "builder", "hacker", "tinkerer"];

function useTypewriter() {
  const [i, setI] = useState(0);
  const [text, setText] = useState("");
  const [del, setDel] = useState(false);

  useEffect(() => {
    const current = TERMS[i];
    const speed = del ? 30 : 65;
    let holdT: ReturnType<typeof setTimeout> | undefined;

    const t = setTimeout(() => {
      if (!del) {
        const next = current.slice(0, text.length + 1);
        setText(next);
        if (next === current) {
          holdT = setTimeout(() => setDel(true), 1400);
        }
      } else {
        const next = current.slice(0, text.length - 1);
        setText(next);
        if (next === "") {
          setDel(false);
          setI((v) => (v + 1) % TERMS.length);
        }
      }
    }, speed);

    return () => {
      clearTimeout(t);
      if (holdT) clearTimeout(holdT);
    };
  }, [text, del, i]);

  return text;
}

export function Nav() {
  const [active, setActive] = useState("");
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [dynamicLinks, setDynamicLinks] = useState<{ href: string; label: string }[]>([]);
  const [hiddenSections, setHiddenSections] = useState<Set<string>>(new Set());
  const typed = useTypewriter();
  const menuBtnRef = useRef<HTMLButtonElement>(null);
  const lastY = useRef(0);
  const visibleBase = baseLinks.filter((l) => !hiddenSections.has(l.section));
  const links = [...visibleBase.slice(0, 7), ...dynamicLinks, ...visibleBase.slice(7)];
  const activeIdx = links.findIndex((l) => l.href === active);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        menuBtnRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  // Lock body scroll when the fullscreen menu is open.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const y = window.scrollY;
        setScrolled(y > 12);
        // Hide on scroll down past the hero, reveal on scroll up.
        const goingDown = y > lastY.current && y > 220;
        lastY.current = y;
        setHidden((h) => (goingDown !== h ? goingDown : h));
      });
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(raf);
    };
  }, []);

  // Show Research / Blogs in the nav only once published via /admin,
  // and hide links for sections the admin turned off.
  useEffect(() => {
    let cancelled = false;
    async function check(kind: "research" | "blog", href: string, label: string) {
      try {
        const res = await fetch(`/api/content?kind=${kind}`);
        if (!res.ok) return null;
        const data = (await res.json()) as { items?: unknown[] };
        if (Array.isArray(data.items) && data.items.length > 0) return { href, label };
      } catch {
        // ignore — link stays hidden
      }
      return null;
    }
    Promise.all([
      check("research", "#research", "Research"),
      check("blog", "#blogs", "Blogs"),
    ]).then((found) => {
      if (!cancelled)
        setDynamicLinks(found.filter((l): l is { href: string; label: string } => !!l));
    });
    fetch("/api/settings", { credentials: "same-origin" })
      .then(async (res) => {
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as { settings?: Record<string, string> };
        const s = data.settings ?? {};
        const hiddenSecs = new Set<string>();
        for (const l of baseLinks) {
          if (s[`section_${l.section}_visible`] === "0") hiddenSecs.add(l.section);
        }
        if (!cancelled) setHiddenSections(hiddenSecs);
      })
      .catch(() => {
        // ignore — all links stay visible
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    // Guarded: without this, a late state update (e.g. a fetch resolving
    // after test teardown unstubs the mock) crashes on the bare constructor.
    // Same guard in use-reveal.ts.
    if (typeof IntersectionObserver === "undefined") return;
    const ids = links.map((l) => l.href.slice(1));
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            setActive("#" + e.target.id);
          } else if (e.target.id === "about") {
            setActive((cur) => (cur === "#about" ? "" : cur));
          }
        });
      },
      { rootMargin: "-45% 0px -50% 0px", threshold: 0 },
    );
    // Sections mount late (content fetch, conditional Research/Blogs,
    // admin visibility toggles) — same flaw class as the reveal cards had.
    // Track late arrivals so scroll-spy never goes blind.
    const observed = new Set<Element>();
    const collect = () => {
      ids.forEach((id) => {
        const s = document.getElementById(id);
        if (s && !observed.has(s)) {
          observed.add(s);
          io.observe(s);
        }
      });
    };
    collect();
    let mo: MutationObserver | undefined;
    if (typeof MutationObserver !== "undefined") {
      mo = new MutationObserver(collect);
      mo.observe(document.body, { childList: true, subtree: true });
    }
    return () => {
      io.disconnect();
      mo?.disconnect();
    };
    // Re-collect when the link set changes (published/hidden sections).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dynamicLinks, hiddenSections]);

  return (
    <>
      <motion.header
        animate={{ y: hidden && !open ? "-115%" : "0%" }}
        transition={{ type: "spring", stiffness: 320, damping: 32 }}
        className={`fixed top-0 inset-x-0 z-50 transition-[padding] duration-300 ${
          scrolled ? "py-3" : "py-5"
        }`}
      >
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div
            style={{ marginTop: "env(safe-area-inset-top)" }}
            className={`flex items-center justify-between gap-2 rounded-2xl px-3 sm:px-4 py-2 transition-all ${
              scrolled ? "glass shadow-elegant" : ""
            }`}
          >
            <a
              href="#top"
              className="flex shrink-0 items-center gap-2 rounded-lg px-1 py-1 font-mono text-sm font-semibold"
            >
              <motion.span
                whileHover={{ scale: 1.35, rotate: 90 }}
                transition={{ type: "spring", stiffness: 500, damping: 20 }}
                className="inline-block h-2 w-2 rounded-full bg-white shadow-[0_0_12px_oklch(0.97_0_0/0.8)]"
              />
              <span className="text-gradient">divyansh.dev</span>
            </a>

            <nav className="hidden lg:flex items-center gap-0.5" aria-label="Primary">
              {links.map((l) => {
                const isActive = active === l.href;
                return (
                  <a
                    key={l.href}
                    href={l.href}
                    className={`relative whitespace-nowrap rounded-lg px-2.5 py-1.5 text-[13px] transition-colors ${
                      isActive
                        ? "text-foreground"
                        : "text-muted-foreground hover:text-foreground hover:bg-white/[0.04]"
                    }`}
                  >
                    {isActive && (
                      <motion.span
                        layoutId="nav-active-underline"
                        transition={{ type: "spring", stiffness: 500, damping: 40 }}
                        className="absolute inset-x-3 -bottom-px h-px bg-gradient-to-r from-transparent via-white to-transparent"
                      />
                    )}
                    <span className="relative">{l.label}</span>
                  </a>
                );
              })}
            </nav>

            <div className="flex shrink-0 items-center gap-2">
              <span
                aria-hidden="true"
                className="hidden w-[7rem] items-center font-mono text-sm text-muted-foreground xl:inline-flex"
              >
                <span className="text-foreground">&gt;</span>
                <span className="ml-1.5 truncate text-foreground/90">{typed}</span>
                <span className="inline-block h-3.5 w-px shrink-0 bg-foreground/80 ml-0.5 animate-blink" />
              </span>

              <motion.button
                onClick={() => window.dispatchEvent(new Event("open-command-palette"))}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                aria-label="Open command palette"
                className="hidden sm:inline-flex items-center gap-1.5 rounded-lg glass px-2.5 py-1.5 font-mono text-[11px] text-muted-foreground hover:text-foreground hover:border-white/25 transition-colors"
              >
                <span className="text-xs">⌘</span>K
              </motion.button>

              <motion.button
                ref={menuBtnRef}
                className="lg:hidden grid place-items-center h-9 w-9 rounded-lg glass"
                onClick={() => setOpen((v) => !v)}
                whileTap={{ scale: 0.88 }}
                aria-label="Menu"
                aria-expanded={open}
                aria-controls="mobile-menu"
              >
                <motion.span
                  animate={{ rotate: open ? 90 : 0 }}
                  transition={{ type: "spring", stiffness: 400, damping: 25 }}
                  className="grid place-items-center"
                >
                  {open ? <X size={16} /> : <Menu size={16} />}
                </motion.span>
              </motion.button>
            </div>
          </div>
        </div>
      </motion.header>

      <AnimatePresence>
        {open && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setOpen(false)}
              aria-hidden="true"
              className="fixed inset-0 z-40 bg-black/70 backdrop-blur-md lg:hidden"
            />
            <motion.div
              id="mobile-menu"
              initial={{ opacity: 0, y: 24, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 16, scale: 0.98 }}
              transition={{ type: "spring", stiffness: 340, damping: 32 }}
              className="fixed inset-x-3 top-24 bottom-6 z-40 flex flex-col overflow-hidden rounded-3xl border border-white/10 bg-[#0b0b0d]/95 shadow-elegant lg:hidden"
            >
              <div className="flex items-center justify-between border-b border-white/10 px-5 py-4 font-mono text-[11px] uppercase tracking-[0.3em] text-muted-foreground">
                <span>~/ navigate</span>
                <span className="tabular-nums">
                  {activeIdx >= 0 ? `${activeIdx + 1}/${links.length}` : `${links.length} links`}
                </span>
              </div>
              <nav className="flex-1 overflow-y-auto p-3" aria-label="Mobile">
                {links.map((l, i) => {
                  const isActive = active === l.href;
                  return (
                    <motion.a
                      key={l.href}
                      href={l.href}
                      onClick={() => setOpen(false)}
                      initial={{ opacity: 0, x: -18 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.04 * i, duration: 0.28, ease: "easeOut" }}
                      className={`group flex items-center gap-4 rounded-2xl px-4 py-3.5 transition-colors ${
                        isActive ? "bg-white/[0.07]" : "hover:bg-white/[0.04]"
                      }`}
                    >
                      <span
                        aria-hidden="true"
                        className="font-mono text-xs text-white/30 tabular-nums"
                      >
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <span
                        className={`text-xl font-semibold tracking-tight ${
                          isActive
                            ? "text-foreground"
                            : "text-muted-foreground group-hover:text-foreground"
                        }`}
                      >
                        {l.label}
                      </span>
                      <ArrowUpRight
                        size={16}
                        className={`ml-auto transition-all ${
                          isActive
                            ? "text-foreground"
                            : "text-white/25 group-hover:text-foreground group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                        }`}
                      />
                    </motion.a>
                  );
                })}
              </nav>
              <div className="flex items-center justify-between border-t border-white/10 px-5 py-4 font-mono text-[11px] text-muted-foreground">
                <span>ESC closes</span>
                <button
                  onClick={() => {
                    setOpen(false);
                    window.dispatchEvent(new Event("open-command-palette"));
                  }}
                  className="rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1.5 hover:text-foreground hover:border-white/25 transition-colors"
                >
                  ⌘K search
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
