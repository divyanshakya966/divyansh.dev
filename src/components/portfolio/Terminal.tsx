import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { TerminalSquare } from "lucide-react";
import { toast } from "sonner";
import { useSiteSettings } from "@/hooks/use-content";
import { safeHref } from "@/lib/utils";
import type { ContentItem } from "@/lib/content";

type Line = { text: string; dim?: boolean };

const HELP: Line[] = [
  { text: "Available commands:", dim: true },
  { text: "  whoami              — who is Divyansh" },
  { text: "  ls ~/skills         — list the toolkit" },
  { text: "  ls ~/projects       — list selected work" },
  { text: "  contact             — how to reach me" },
  { text: "  open <github|linkedin|resume> — open in new tab" },
  { text: "  goto <section>      — jump (about, skills, projects, contact…)" },
  { text: "  date                — IST time" },
  { text: "  clear               — clear the screen" },
];

const SECTIONS = [
  "about",
  "skills",
  "projects",
  "experience",
  "certifications",
  "achievements",
  "building",
  "contact",
];

function istNow(): string {
  const utc = Date.now() + new Date().getTimezoneOffset() * 60000;
  const ist = new Date(utc + 5.5 * 3600000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(ist.getHours())}:${pad(ist.getMinutes())}:${pad(ist.getSeconds())} IST`;
}

export function Terminal() {
  const [open, setOpen] = useState(false);
  const [lines, setLines] = useState<Line[]>([
    { text: "divyansh.dev — guest shell. Type 'help'.", dim: true },
  ]);
  const [value, setValue] = useState("");
  const [cache, setCache] = useState<Partial<Record<string, ContentItem[]>>>({});
  const { settings } = useSiteSettings();
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const emailRaw = (settings.contact_email ?? "").trim();
  const email = emailRaw.includes("@") ? emailRaw : "divyanshakya.dev@gmail.com";
  const github = safeHref(settings.social_github ?? "", "https://github.com/divyanshakya966");

  useEffect(() => {
    const onCustom = () => setOpen(true);
    window.addEventListener("open-terminal", onCustom);
    return () => window.removeEventListener("open-terminal", onCustom);
  }, []);

  useEffect(() => {
    if (open) {
      setValue("");
      window.setTimeout(() => inputRef.current?.focus(), 60);
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [lines, open]);

  const fetchKind = async (kind: string): Promise<ContentItem[]> => {
    if (cache[kind]) return cache[kind]!;
    try {
      const res = await fetch(`/api/content?kind=${kind}`, { credentials: "same-origin" });
      if (!res.ok) return [];
      const data = (await res.json()) as { items?: ContentItem[] };
      const items = Array.isArray(data.items) ? data.items : [];
      setCache((c) => ({ ...c, [kind]: items }));
      return items;
    } catch {
      return [];
    }
  };

  const print = (next: Line[]) => setLines((prev) => [...prev.slice(-60), ...next]);

  const run = async (raw: string) => {
    const [cmd = "", ...args] = raw.trim().split(/\s+/);
    print([{ text: `$ ${raw.trim()}` }]);
    switch (cmd.toLowerCase()) {
      case "":
        break;
      case "help":
        print(HELP);
        break;
      case "whoami":
        print([
          { text: "Divyansh Shakya — aspiring Security Engineer (Bhopal, IN)" },
          { text: "DevSecOps · Linux · Cloud · AI security", dim: true },
        ]);
        break;
      case "ls": {
        const target = (args[0] ?? "").replace(/^~\/|^\/|\/$/g, "") || "home";
        if (target === "home") {
          print([{ text: SECTIONS.map((s) => `~/${s}`).join("   ") }]);
        } else if (target === "skills") {
          const items = await fetchKind("skill");
          print(
            items.length > 0
              ? items.flatMap((g) => [
                  { text: `~/skills/${g.title}:` },
                  ...g.tags.map((t) => ({ text: `  ▸ ${t}`, dim: true })),
                ])
              : [{ text: "skills: (offline — try the Skills section)", dim: true }],
          );
        } else if (target === "projects") {
          const items = await fetchKind("project");
          print(
            items.length > 0
              ? items.map((p) => ({ text: `  ▸ ${p.title} — ${p.subtitle || "project"}` }))
              : [{ text: "projects: (offline — try the Projects section)", dim: true }],
          );
        } else {
          print([
            { text: `ls: cannot access '${args[0]}': try ~/skills or ~/projects`, dim: true },
          ]);
        }
        break;
      }
      case "skills":
        print([{ text: "hint: ls ~/skills", dim: true }]);
        break;
      case "projects":
        print([{ text: "hint: ls ~/projects", dim: true }]);
        break;
      case "contact":
        print([
          { text: `email: ${email}` },
          { text: "tip: the form below the fold works too", dim: true },
        ]);
        break;
      case "open": {
        const where = (args[0] ?? "").toLowerCase();
        if (where === "github") window.open(github, "_blank", "noopener");
        else if (where === "linkedin")
          window.open("https://www.linkedin.com/in/divyanshakya966", "_blank", "noopener");
        else if (where === "resume")
          window.open("/resume/Divyansh_Shakya_Resume_Digital.pdf", "_blank", "noopener");
        else {
          print([{ text: "open: github | linkedin | resume", dim: true }]);
          break;
        }
        print([{ text: `opening ${where}…`, dim: true }]);
        break;
      }
      case "goto": {
        const where = (args[0] ?? "").toLowerCase();
        if (SECTIONS.includes(where)) {
          setOpen(false);
          window.setTimeout(
            () => document.getElementById(where)?.scrollIntoView({ behavior: "smooth" }),
            80,
          );
        } else {
          print([
            {
              text: `goto: unknown section '${args[0] ?? ""}' — try: ${SECTIONS.join(", ")}`,
              dim: true,
            },
          ]);
        }
        break;
      }
      case "date":
        print([{ text: istNow() }]);
        break;
      case "echo":
        print([{ text: args.join(" ") }]);
        break;
      case "clear":
        setLines([]);
        break;
      case "sudo":
        if (
          args.join(" ").toLowerCase() === "hire-me" ||
          args.join(" ").toLowerCase() === "hire me"
        ) {
          print([{ text: "permission granted. excellent choice.", dim: true }]);
          setOpen(false);
          window.setTimeout(
            () => document.getElementById("contact")?.scrollIntoView({ behavior: "smooth" }),
            250,
          );
          toast.success("Let's build something secure together.");
        } else {
          print([{ text: "sudo: nice try. this is a guest shell.", dim: true }]);
        }
        break;
      case "exit":
      case "quit":
        setOpen(false);
        break;
      default:
        print([{ text: `command not found: ${cmd} — try 'help'`, dim: true }]);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[95] grid place-items-start justify-center px-4 pt-[12svh] bg-black/60 backdrop-blur-sm"
          onClick={() => setOpen(false)}
          role="presentation"
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Terminal"
            initial={{ opacity: 0, y: 18, scale: 0.97, filter: "blur(8px)" }}
            animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
            exit={{ opacity: 0, y: 10, scale: 0.98, filter: "blur(6px)" }}
            transition={{ type: "spring", stiffness: 420, damping: 34, mass: 0.6 }}
            className="w-full max-w-xl overflow-hidden rounded-2xl border border-white/10 bg-[#0b0b0d]/95 shadow-elegant"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 border-b border-white/10 bg-white/[0.02] px-4 py-3">
              <span className="flex gap-1.5" aria-hidden="true">
                <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
                <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
                <span className="h-2.5 w-2.5 rounded-full bg-white/40" />
              </span>
              <span className="ml-2 flex items-center gap-1.5 font-mono text-[11px] text-muted-foreground">
                <TerminalSquare size={13} /> guest@divyansh.dev
              </span>
              <span className="ml-auto hidden sm:block rounded-md border border-white/10 bg-white/[0.04] px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                ESC
              </span>
            </div>
            <div
              ref={scrollRef}
              className="h-[38svh] min-h-[240px] overflow-y-auto p-4 font-mono text-[13px] leading-relaxed"
            >
              {lines.map((l, i) => (
                <div key={i} className={l.dim ? "text-muted-foreground" : "text-foreground"}>
                  {l.text || " "}
                </div>
              ))}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const v = value;
                  setValue("");
                  void run(v);
                }}
                className="mt-1 flex items-center gap-2"
              >
                <span aria-hidden="true" className="shrink-0 text-white">
                  $
                </span>
                <input
                  ref={inputRef}
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") setOpen(false);
                  }}
                  aria-label="Terminal input"
                  autoComplete="off"
                  autoCapitalize="off"
                  spellCheck={false}
                  placeholder="help"
                  className="w-full bg-transparent text-base sm:text-[13px] text-foreground outline-none placeholder:text-muted-foreground/50"
                />
              </form>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
