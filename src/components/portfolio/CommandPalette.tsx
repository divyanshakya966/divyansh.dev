import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowUpRight, Copy, Mail, Github, Linkedin, Terminal } from "lucide-react";
import { toast } from "sonner";
import { useKindPresence, useSiteSettings } from "@/hooks/use-content";
import { isSectionVisible, type SectionId } from "@/lib/settings";
import { safeHref } from "@/lib/utils";

type Action = {
  id: string;
  group: string;
  label: string;
  hint?: string;
  icon: typeof ArrowUpRight;
  run: () => void;
};

const DEFAULT_EMAIL = "divyanshakya.dev@gmail.com";
const DEFAULT_GITHUB = "https://github.com/divyanshakya966";
const DEFAULT_LINKEDIN = "https://www.linkedin.com/in/divyanshakya966";

const LINKS: { href: string; label: string; section: SectionId }[] = [
  { href: "#about", label: "About", section: "about" },
  { href: "#skills", label: "Skills", section: "skills" },
  { href: "#projects", label: "Projects", section: "projects" },
  { href: "#experience", label: "Experience", section: "experience" },
  { href: "#certifications", label: "Certifications", section: "certifications" },
  { href: "#achievements", label: "Achievements", section: "achievements" },
  { href: "#building", label: "Building", section: "building" },
  { href: "#contact", label: "Contact", section: "contact" },
];

const CONDITIONAL_LINKS: { href: string; label: string; kind: "research" | "blog" }[] = [
  { href: "#research", label: "Research", kind: "research" },
  { href: "#blogs", label: "Blogs", kind: "blog" },
];

function go(href: string) {
  const el = document.querySelector(href);
  if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  else window.location.hash = href;
}

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [idx, setIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const { settings } = useSiteSettings();
  const researchLive = useKindPresence("research");
  const blogsLive = useKindPresence("blog");

  const emailRaw = (settings.contact_email ?? "").trim();
  const email = emailRaw.includes("@") ? emailRaw : DEFAULT_EMAIL;
  const github = safeHref(settings.social_github ?? "", DEFAULT_GITHUB) || DEFAULT_GITHUB;
  const linkedin = safeHref(settings.social_linkedin ?? "", DEFAULT_LINKEDIN) || DEFAULT_LINKEDIN;
  const visibleLinks = useMemo(
    () => LINKS.filter((l) => isSectionVisible(settings, l.section)),
    [settings],
  );
  const conditionalLinks = useMemo(
    () => CONDITIONAL_LINKS.filter((l) => (l.kind === "research" ? researchLive : blogsLive)),
    [researchLive, blogsLive],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      } else if (e.key === "Escape") {
        setOpen(false);
      } else if (e.key === "/" && !open) {
        const t = document.activeElement as HTMLElement | null;
        const typing =
          t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable);
        if (!typing) {
          e.preventDefault();
          setOpen(true);
        }
      }
    };
    const onCustom = () => setOpen(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener("open-command-palette", onCustom);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("open-command-palette", onCustom);
    };
  }, [open]);

  useEffect(() => {
    if (open) {
      setQ("");
      setIdx(0);
      window.setTimeout(() => inputRef.current?.focus(), 30);
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  const actions: Action[] = useMemo(
    () => [
      ...visibleLinks.map((l) => ({
        id: `go-${l.href}`,
        group: "Go to",
        label: l.label,
        hint: l.href,
        icon: ArrowUpRight,
        run: () => go(l.href),
      })),
      ...conditionalLinks.map((l) => ({
        id: `go-${l.href}`,
        group: "Go to",
        label: l.label,
        hint: l.href,
        icon: ArrowUpRight,
        run: () => go(l.href),
      })),
      {
        id: "copy-email",
        group: "Actions",
        label: "Copy email",
        hint: email,
        icon: Copy,
        run: async () => {
          try {
            await navigator.clipboard.writeText(email);
            toast.success("Email copied");
          } catch {
            toast.error("Copy failed");
          }
        },
      },
      {
        id: "github",
        group: "Actions",
        label: "Open GitHub",
        icon: Github,
        run: () => window.open(github, "_blank"),
      },
      {
        id: "linkedin",
        group: "Actions",
        label: "Open LinkedIn",
        icon: Linkedin,
        run: () => window.open(linkedin, "_blank"),
      },
      {
        id: "mail",
        group: "Actions",
        label: "Email me",
        icon: Mail,
        run: () => {
          window.location.href = `mailto:${email}`;
        },
      },
      {
        id: "top",
        group: "Actions",
        label: "Back to top",
        hint: "#top",
        icon: Terminal,
        run: () => window.scrollTo({ top: 0, behavior: "smooth" }),
      },
    ],
    [visibleLinks, conditionalLinks, email, github, linkedin],
  );

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return actions;
    return actions.filter(
      (a) =>
        a.label.toLowerCase().includes(needle) ||
        a.group.toLowerCase().includes(needle) ||
        (a.hint ?? "").toLowerCase().includes(needle),
    );
  }, [actions, q]);

  useEffect(() => setIdx(0), [q]);

  const runAt = (i: number) => {
    const a = filtered[i];
    if (!a) return;
    setOpen(false);
    window.setTimeout(() => a.run(), 60);
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[90] grid place-items-start justify-center px-4 pt-[14vh] bg-black/60 backdrop-blur-sm"
          onClick={() => setOpen(false)}
          role="presentation"
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Command palette"
            initial={{ opacity: 0, y: 16, scale: 0.97, filter: "blur(8px)" }}
            animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
            exit={{ opacity: 0, y: 10, scale: 0.98, filter: "blur(6px)" }}
            transition={{ type: "spring", stiffness: 420, damping: 34, mass: 0.6 }}
            className="w-full max-w-lg overflow-hidden rounded-2xl border border-white/10 bg-[#0c0c0e]/95 shadow-elegant"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 border-b border-white/10 px-4">
              <Terminal size={14} className="text-muted-foreground" />
              <input
                ref={inputRef}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "ArrowDown") {
                    e.preventDefault();
                    setIdx((v) => Math.min(v + 1, filtered.length - 1));
                  } else if (e.key === "ArrowUp") {
                    e.preventDefault();
                    setIdx((v) => Math.max(v - 1, 0));
                  } else if (e.key === "Enter") {
                    runAt(idx);
                  }
                }}
                placeholder="Type a command or search…  (~/about, ~/projects)"
                className="w-full bg-transparent py-3.5 text-sm outline-none placeholder:text-muted-foreground/70"
              />
              <kbd className="rounded-md border border-white/10 bg-white/[0.04] px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                ESC
              </kbd>
            </div>
            <div className="max-h-[46vh] overflow-y-auto p-2">
              {filtered.length === 0 && (
                <div className="px-3 py-8 text-center font-mono text-xs text-muted-foreground">
                  No matches for “{q}” — try ~/projects
                </div>
              )}
              {filtered.map((a, i) => {
                const Icon = a.icon;
                const active = i === idx;
                return (
                  <button
                    key={a.id}
                    onMouseEnter={() => setIdx(i)}
                    onClick={() => runAt(i)}
                    className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition-colors ${
                      active ? "bg-white/[0.07] text-foreground" : "text-muted-foreground"
                    }`}
                  >
                    <span
                      className={`grid place-items-center h-8 w-8 rounded-lg border ${
                        active ? "border-white/20 bg-white/[0.06]" : "border-white/10"
                      }`}
                    >
                      <Icon size={14} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{a.label}</span>
                      <span className="block truncate font-mono text-[11px] opacity-70">
                        {a.group}
                        {a.hint ? ` · ${a.hint}` : ""}
                      </span>
                    </span>
                    {active && <span className="font-mono text-[10px] opacity-60">↵</span>}
                  </button>
                );
              })}
            </div>
            <div className="flex items-center gap-4 border-t border-white/10 px-4 py-2.5 font-mono text-[10px] text-muted-foreground">
              <span>↑↓ navigate</span>
              <span>↵ select</span>
              <span className="ml-auto">⌘K toggle</span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
