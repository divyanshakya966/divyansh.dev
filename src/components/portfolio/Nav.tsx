import { useEffect, useRef, useState } from "react";
import { Menu, X } from "lucide-react";

const links = [
  { href: "#about", label: "About" },
  { href: "#skills", label: "Skills" },
  { href: "#projects", label: "Projects" },
  { href: "#experience", label: "Experience" },
  { href: "#achievements", label: "Achievements" },
  { href: "#building", label: "Building" },
  { href: "#contact", label: "Contact" },
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
  const typed = useTypewriter();
  const menuBtnRef = useRef<HTMLButtonElement>(null);

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

  useEffect(() => {
    const ids = links.map((l) => l.href.slice(1));
    const sections = ids
      .map((id) => document.getElementById(id))
      .filter((s): s is HTMLElement => !!s);
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
    sections.forEach((s) => io.observe(s));
    return () => io.disconnect();
  }, []);

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
