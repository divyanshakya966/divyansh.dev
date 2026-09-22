import { useEffect, useRef, useState } from "react";
import { Menu, X } from "lucide-react";

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
  const [dynamicLinks, setDynamicLinks] = useState<{ href: string; label: string }[]>([]);
  const [hiddenSections, setHiddenSections] = useState<Set<string>>(new Set());
  const typed = useTypewriter();
  const menuBtnRef = useRef<HTMLButtonElement>(null);
  const visibleBase = baseLinks.filter((l) => !hiddenSections.has(l.section));
  const links = [...visibleBase.slice(0, 7), ...dynamicLinks, ...visibleBase.slice(7)];

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

  useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > 12);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
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
        const hidden = new Set<string>();
        for (const l of baseLinks) {
          if (s[`section_${l.section}_visible`] === "0") hidden.add(l.section);
        }
        if (!cancelled) setHiddenSections(hidden);
      })
      .catch(() => {
        // ignore — all links stay visible
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
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
    const mo = new MutationObserver(collect);
    mo.observe(document.body, { childList: true, subtree: true });
    return () => {
      io.disconnect();
      mo.disconnect();
    };
    // Re-collect when the link set changes (published/hidden sections).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dynamicLinks, hiddenSections]);

  return (
    <header
      className={`fixed top-0 inset-x-0 z-50 transition-all duration-300 ${
        scrolled ? "py-3" : "py-5"
      }`}
    >
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div
          style={{ marginTop: "env(safe-area-inset-top)" }}
          className={`flex items-center justify-between rounded-2xl px-4 sm:px-5 py-2.5 transition-all ${
            scrolled ? "glass shadow-elegant" : ""
          }`}
        >
          <a href="#top" className="flex items-center gap-2 font-mono text-sm font-semibold">
            <span className="inline-block h-2 w-2 rounded-full bg-gradient-to-br from-cyan to-violet animate-pulse-slow" />
            <span className="text-gradient">divyansh.dev</span>
          </a>

          <nav className="hidden md:flex items-center gap-0.5 xl:gap-1">
            {links.map((l) => (
              <a
                key={l.href}
                href={l.href}
                className={`relative px-2.5 xl:px-3 py-1.5 text-sm rounded-lg transition-colors ${
                  active === l.href
                    ? "text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {l.label}
                {active === l.href && (
                  <span className="absolute inset-x-3 -bottom-px h-px bg-gradient-to-r from-transparent via-primary to-transparent" />
                )}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <span
              aria-hidden="true"
              className="hidden lg:inline-flex items-center font-mono text-sm text-muted-foreground min-w-[5.5rem]"
            >
              <span className="text-foreground">&gt;</span>
              <span className="ml-1.5 text-foreground/90">{typed}</span>
              <span className="inline-block h-3.5 w-px bg-foreground/80 ml-0.5 animate-blink" />
            </span>

            <button
              ref={menuBtnRef}
              className="md:hidden grid place-items-center h-9 w-9 rounded-lg glass"
              onClick={() => setOpen((v) => !v)}
              aria-label="Menu"
              aria-expanded={open}
              aria-controls="mobile-menu"
            >
              {open ? <X size={16} /> : <Menu size={16} />}
            </button>
          </div>
        </div>

        {open && (
          <div id="mobile-menu" className="md:hidden mt-2 glass rounded-2xl p-2 animate-fade-in">
            {links.map((l) => (
              <a
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className="block px-4 py-2.5 text-sm rounded-lg hover:bg-muted"
              >
                {l.label}
              </a>
            ))}
          </div>
        )}
      </div>
    </header>
  );
}
