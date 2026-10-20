import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  ArrowUpRight,
  Copy,
  Mail,
  Github,
  Linkedin,
  Terminal,
  Minus,
  Minimize2,
  Square,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { useKindPresence, useSiteSettings } from "@/hooks/use-content";
import { NAV_OFFSET, useWindowManager } from "@/hooks/use-window-manager";
import { ResizeHandles } from "@/components/portfolio/ResizeHandles";
import { isSectionVisible, type SectionId } from "@/lib/settings";
import { safeHref } from "@/lib/utils";

import { CONTENT_KINDS, type ContentItem, type ContentKind } from "@/lib/content";

type Action = {
  id: string;
  group: string;
  label: string;
  hint?: string;
  /** Extra searchable text (not displayed). */
  search?: string;
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

const KIND_SECTION: Record<ContentKind, string> = {
  certification: "certifications",
  research: "research",
  blog: "blogs",
  project: "projects",
  experience: "experience",
  achievement: "achievements",
  skill: "skills",
  about: "about",
  building: "building",
  testimonial: "testimonials",
};

const KIND_LABEL: Record<ContentKind, string> = {
  certification: "Certification",
  research: "Research",
  blog: "Post",
  project: "Project",
  experience: "Experience",
  achievement: "Achievement",
  skill: "Skill",
  about: "About",
  building: "Status",
  testimonial: "Kind word",
};

const CONDITIONAL_LINKS: {
  href: string;
  label: string;
  kind: "research" | "blog" | "testimonial";
}[] = [
  { href: "#research", label: "Research", kind: "research" },
  { href: "#blogs", label: "Blogs", kind: "blog" },
  { href: "#testimonials", label: "Kind words", kind: "testimonial" },
];

function go(href: string) {
  const el = document.querySelector(href);
  if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  else window.location.hash = href;
}

export function CommandPalette() {
  const {
    isOpen: open,
    isMinimized,
    isMaximized,
    isFocused,
    rect,
    startDrag,
    startResize,
    focus,
    minimize,
    maximize,
    toggle,
    close,
  } = useWindowManager("command-palette");
  const [q, setQ] = useState("");
  const [idx, setIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const { settings } = useSiteSettings();
  const researchLive = useKindPresence("research");
  const blogsLive = useKindPresence("blog");
  const testimonialsLive = useKindPresence("testimonial");

  const emailRaw = (settings.contact_email ?? "").trim();
  const email = emailRaw.includes("@") ? emailRaw : DEFAULT_EMAIL;
  const github = safeHref(settings.social_github ?? "", DEFAULT_GITHUB) || DEFAULT_GITHUB;
  const linkedin = safeHref(settings.social_linkedin ?? "", DEFAULT_LINKEDIN) || DEFAULT_LINKEDIN;
  const visibleLinks = useMemo(
    () => LINKS.filter((l) => isSectionVisible(settings, l.section)),
    [settings],
  );
  const conditionalLinks = useMemo(() => {
    const live = { research: researchLive, blog: blogsLive, testimonial: testimonialsLive };
    return CONDITIONAL_LINKS.filter((l) => live[l.kind]);
  }, [researchLive, blogsLive, testimonialsLive]);

  // Full-text index across all public content, loaded lazily on first open
  // (responses are browser-cached; capped so the palette stays instant).
  const [contentActions, setContentActions] = useState<Action[]>([]);
  const indexLoaded = useRef(false);
  useEffect(() => {
    if (!open || indexLoaded.current) return;
    indexLoaded.current = true;
    (async () => {
      const out: Action[] = [];
      await Promise.all(
        CONTENT_KINDS.map(async (kind) => {
          try {
            const res = await fetch(`/api/content?kind=${kind}`, {
              credentials: "same-origin",
            });
            if (!res.ok) return;
            const data = (await res.json()) as { items?: ContentItem[] };
            if (!Array.isArray(data.items)) return;
            for (const item of data.items.slice(0, 12)) {
              const absolute = /^https?:\/\//i.test(item.url ?? "");
              out.push({
                id: `content-${kind}-${String(item.id)}`,
                group: KIND_LABEL[kind],
                label: item.title,
                hint: item.subtitle || `#${KIND_SECTION[kind]}`,
                search: [item.subtitle, item.description, (item.tags ?? []).join(" ")]
                  .filter(Boolean)
                  .join(" "),
                icon: ArrowUpRight,
                run: () => {
                  if (absolute) window.open(item.url, "_blank", "noopener");
                  else go(`#${KIND_SECTION[kind]}`);
                },
              });
            }
          } catch {
            // search degrades to navigation actions
          }
        }),
      );
      setContentActions(out.slice(0, 80));
    })();
  }, [open]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // The boot screen sits above this window — the palette would be invisible.
      if (document.getElementById("boot-screen")) return;
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === "k") {
        e.preventDefault();
        toggle();
      } else if (e.key === "Escape" && open && isFocused) {
        minimize();
      }
      // NOTE: no "/" shortcut — it would hijack Firefox quick-find.
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
    };
  }, [open, isFocused, minimize, toggle]);

  useEffect(() => {
    let focusTimer: ReturnType<typeof setTimeout> | undefined;
    if (open) {
      setQ("");
      setIdx(0);
      focusTimer = setTimeout(() => inputRef.current?.focus(), 30);
    }
    return () => {
      if (focusTimer) clearTimeout(focusTimer);
    };
  }, [open]);

  // Restoring should hand focus back to the search input.
  useEffect(() => {
    if (open && !isMinimized) inputRef.current?.focus();
  }, [open, isMinimized]);

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
      {
        id: "terminal",
        group: "Actions",
        label: "Open terminal",
        hint: "guest shell",
        icon: Terminal,
        run: () => window.dispatchEvent(new Event("open-terminal")),
      },
      ...contentActions,
    ],
    [visibleLinks, conditionalLinks, contentActions, email, github, linkedin],
  );

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return actions;
    return actions.filter(
      (a) =>
        a.label.toLowerCase().includes(needle) ||
        a.group.toLowerCase().includes(needle) ||
        (a.hint ?? "").toLowerCase().includes(needle) ||
        (a.search ?? "").toLowerCase().includes(needle),
    );
  }, [actions, q]);

  useEffect(() => setIdx(0), [q]);

  const runAt = (i: number) => {
    const a = filtered[i];
    if (!a) return;
    close();
    window.setTimeout(() => a.run(), 60);
  };

  return (
    <AnimatePresence>
      {open && !isMinimized && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className={`fixed inset-0 pointer-events-none ${isFocused ? "z-[97]" : "z-[93]"}`}
          role="presentation"
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Command palette"
            initial={{ opacity: 0, scale: 0.97, filter: "blur(8px)" }}
            animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
            exit={{ opacity: 0, scale: 0.98, filter: "blur(6px)" }}
            transition={{ type: "spring", stiffness: 420, damping: 34, mass: 0.6 }}
            style={
              isMaximized
                ? {
                    left: 8,
                    top: NAV_OFFSET,
                    width: "calc(100vw - 16px)",
                    height: `calc(100svh - ${NAV_OFFSET + 8}px)`,
                  }
                : { left: rect.x, top: rect.y, width: rect.w, height: rect.h }
            }
            className={`pointer-events-auto absolute flex flex-col overflow-hidden bg-[#0c0c0e]/95 shadow-elegant ${
              isMaximized
                ? "rounded-lg border border-white/10"
                : "rounded-2xl border border-white/10"
            }`}
            onMouseDown={focus}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              onPointerDown={startDrag}
              data-cursor={isMaximized ? undefined : "grab"}
              className={`relative z-20 flex shrink-0 items-center gap-1.5 border-b border-white/10 bg-white/[0.02] px-3 py-2.5 ${
                isMaximized ? "" : "cursor-grab active:cursor-grabbing"
              }`}
            >
              <button
                type="button"
                onClick={close}
                aria-label="Close command palette"
                title="Close"
                className="grid h-6 w-6 place-items-center rounded-full border border-white/10 bg-white/[0.04] text-muted-foreground transition-colors hover:border-red-400/40 hover:bg-red-500/25 hover:text-red-200"
              >
                <X size={11} />
              </button>
              <button
                type="button"
                onClick={minimize}
                aria-label="Minimize command palette"
                title="Minimize"
                className="grid h-6 w-6 place-items-center rounded-full border border-white/10 bg-white/[0.04] text-muted-foreground transition-colors hover:border-amber-400/40 hover:bg-amber-500/25 hover:text-amber-200"
              >
                <Minus size={11} />
              </button>
              <button
                type="button"
                onClick={maximize}
                aria-label={isMaximized ? "Restore command palette" : "Maximize command palette"}
                title={isMaximized ? "Restore" : "Maximize"}
                className="grid h-6 w-6 place-items-center rounded-full border border-white/10 bg-white/[0.04] text-muted-foreground transition-colors hover:border-emerald-400/40 hover:bg-emerald-500/25 hover:text-emerald-200"
              >
                {isMaximized ? <Minimize2 size={11} /> : <Square size={10} />}
              </button>
              <span className="ml-2 font-mono text-[11px] text-muted-foreground">search</span>
            </div>
            <div className="flex shrink-0 items-center gap-2 px-4">
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
                className="w-full bg-transparent py-3.5 text-base sm:text-sm outline-none placeholder:text-muted-foreground/70"
              />
              <kbd className="rounded-md border border-white/10 bg-white/[0.04] px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                ESC
              </kbd>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-2">
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
            <div className="flex shrink-0 items-center gap-4 border-t border-white/10 px-4 py-2.5 font-mono text-[10px] text-muted-foreground">
              <span>↑↓ navigate</span>
              <span>↵ select</span>
              <span className="ml-auto">⌘K toggle</span>
              <span>⌘` terminal</span>
            </div>
            {!isMaximized && <ResizeHandles onResize={startResize} label="command palette" />}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
