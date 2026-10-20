import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { TerminalSquare, Minus, Minimize2, Square, X } from "lucide-react";
import { toast } from "sonner";
import { useSiteSettings } from "@/hooks/use-content";
import { NAV_OFFSET, useWindowManager } from "@/hooks/use-window-manager";
import { ResizeHandles } from "@/components/portfolio/ResizeHandles";
import { safeHref } from "@/lib/utils";
import type { ContentItem } from "@/lib/content";

type Line = { text: string; dim?: boolean };

/** First-word completions; also the pool for `man` pages. */
const COMMANDS = [
  "help",
  "whoami",
  "ls",
  "cat",
  "goto",
  "open",
  "contact",
  "neofetch",
  "uname",
  "uptime",
  "pwd",
  "history",
  "man",
  "ping",
  "cowsay",
  "ps",
  "apt",
  "vim",
  "nano",
  "sl",
  "reboot",
  "shutdown",
  "date",
  "echo",
  "clear",
  "exit",
];

const HELP: Line[] = [
  { text: "Available commands:", dim: true },
  { text: "  whoami / contact    — identity & how to reach me" },
  { text: "  ls ~/skills         — list the toolkit" },
  { text: "  ls ~/projects       — list selected work" },
  { text: "  cat ~/contact.txt   — read a pseudo-file" },
  { text: "  goto <section>      — jump (about, skills, projects, contact…)" },
  { text: "  open <github|linkedin|resume> — open in new tab" },
  { text: "  neofetch / uname / uptime / ps  — system jazz" },
  { text: "  ping <host> / man <cmd> / cowsay <msg>" },
  { text: "  reboot              — replay the GRUB boot sequence" },
  { text: "  exit / clear        — window hygiene" },
  { text: "", dim: true },
  {
    text: "  ↑/↓ history · Tab completes · Ctrl+L clear · Ctrl+C abort",
    dim: true,
  },
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

const MAN_PAGES: Record<string, Line[]> = {
  ls: [
    { text: "LS(1) — list directory contents" },
    { text: "  ls            list the ~ sections" },
    { text: "  ls ~/skills   read the toolkit" },
    { text: "  ls ~/projects read selected work", dim: true },
  ],
  goto: [
    { text: "GOTO(1) — navigate the page" },
    { text: " goto <section>  closes this shell and scrolls to the section", dim: true },
  ],
  cowsay: [
    { text: "COWSAY(1) — a cow that is asked to say something durable" },
    { text: " cowsay <message>   {default} moo'd — try: cowsay hire-me", dim: true },
  ],
  reboot: [
    { text: "REBOOT(1) — replay the GNU GRUB screen" },
    { text: " reboot   closes this shell and boots divyansh.dev from scratch", dim: true },
  ],
  sudo: [
    { text: "sudo(8): this is a guest shell. 'sudo hire-me' lives outside the sudoers file." },
  ],
};

/** 28px-ish wide cow — keep it mono-safe. */
const COW = [
  "        \\   ^__^",
  "         \\  (oo)\\_______",
  "            (__)\\       )\\/\\",
  "                ||----w |",
  "                ||     ||",
];

function cowLines(msg: string): Line[] {
  const m = msg.slice(0, 44) || "moo";
  const bar = "-".repeat(m.length + 2);
  const blank = " ".repeat(m.length + 2);
  return [
    { text: ` _${bar}_` },
    { text: `< ${m} >` },
    { text: ` -${bar}-` },
    ...COW.map((l) => ({ text: l })),
  ];
}

function istNow(): string {
  const utc = Date.now() + new Date().getTimezoneOffset() * 60000;
  const ist = new Date(utc + 5.5 * 3600000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(ist.getHours())}:${pad(ist.getMinutes())}:${pad(ist.getSeconds())} IST`;
}

function prettyUptime(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(s / 60);
  return m > 0 ? `${m}m ${s % 60}s` : `${s}s`;
}

export function Terminal() {
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
  } = useWindowManager("terminal");
  const [lines, setLines] = useState<Line[]>([
    { text: "divyansh.dev — guest shell. Type 'help'.", dim: true },
  ]);
  const [value, setValue] = useState("");
  const [cache, setCache] = useState<Partial<Record<string, ContentItem[]>>>({});
  // Command history for ↑/↓ recall; -1 means "no history position".
  const [history, setHistory] = useState<string[]>([]);
  const histIdx = useRef(-1);
  const bootedAt = useRef(0);
  const { settings } = useSiteSettings();
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const emailRaw = (settings.contact_email ?? "").trim();
  const email = emailRaw.includes("@") ? emailRaw : "divyanshakya.dev@gmail.com";
  const github = safeHref(settings.social_github ?? "", "https://github.com/divyanshakya966");
  // Anchored in an effect: Date.now() must not run during render.
  useEffect(() => {
    if (bootedAt.current === 0) bootedAt.current = Date.now();
  }, []);

  // Ctrl/Cmd+` toggles the guest shell from anywhere; Escape minimizes it
  // back to the taskbar (close lives on the window's ✕ / `exit`).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // The boot screen sits above this window — the shell would be invisible.
      if (document.getElementById("boot-screen")) return;
      const mod = e.metaKey || e.ctrlKey;
      if (e.key === "Escape" && open && isFocused) {
        minimize();
        return;
      }
      if (mod && e.key === "`") {
        e.preventDefault();
        toggle();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, isFocused, minimize, toggle]);

  useEffect(() => {
    if (open) {
      setValue("");
      window.setTimeout(() => inputRef.current?.focus(), 60);
    }
  }, [open]);

  // Restoring should hand focus back to the prompt.
  useEffect(() => {
    if (open && !isMinimized) inputRef.current?.focus();
  }, [open, isMinimized]);

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

  const cycleHistory = (dir: -1 | 1) => {
    if (dir === -1) {
      histIdx.current =
        histIdx.current === -1 ? history.length - 1 : Math.max(0, histIdx.current - 1);
    } else if (histIdx.current !== -1) {
      histIdx.current = histIdx.current + 1 >= history.length ? -1 : histIdx.current + 1;
    }
    setValue(histIdx.current === -1 ? "" : (history[histIdx.current] ?? ""));
  };

  const complete = () => {
    const parts = value.split(/\s+/);
    const last = parts[parts.length - 1] ?? "";
    const head = (parts[0] ?? "").toLowerCase();
    let pool: string[];
    if (parts.length <= 1) pool = COMMANDS;
    else if (head === "goto") pool = SECTIONS;
    else if (head === "ls") pool = ["~", "~/skills", "~/projects"];
    else if (head === "open") pool = ["github", "linkedin", "resume"];
    else if (head === "cat") pool = ["~/contact.txt", "~/about.txt"];
    else if (head === "man") pool = COMMANDS;
    else if (head === "ping") pool = ["1.1.1.1", "8.8.8.8", "divyansh.dev"];
    else return;
    const matches = pool.filter((p) => p.startsWith(last));
    if (matches.length === 1) {
      setValue(parts.slice(0, -1).concat(matches[0]).join(" ") + " ");
    } else if (matches.length > 1) {
      print([{ text: matches.join("   "), dim: true }]);
    }
  };

  const onInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowUp") {
      e.preventDefault();
      cycleHistory(-1);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      cycleHistory(1);
    } else if (e.key === "Tab") {
      e.preventDefault();
      complete();
    } else if (e.ctrlKey && e.key.toLowerCase() === "l") {
      e.preventDefault();
      setLines([]);
    } else if (e.ctrlKey && e.key.toLowerCase() === "c") {
      // Ctrl+C = copy when text is selected in the terminal, shell-abort otherwise.
      const hasSelection = (window.getSelection()?.toString() ?? "").length > 0;
      if (hasSelection) return;
      e.preventDefault();
      print([{ text: `^C`, dim: true }]);
      setValue("");
    }
  };

  const run = async (raw: string) => {
    const [cmd = "", ...args] = raw.trim().split(/\s+/);
    print([{ text: `$ ${raw.trim()}` }]);
    if (raw.trim()) {
      setHistory((h) => [...h.slice(-99), raw.trim()]);
      histIdx.current = -1;
    }
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
          close();
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
      case "pwd":
        print([{ text: "/home/guest" }]);
        break;
      case "uptime":
        print([
          {
            text: `up ${prettyUptime(Date.now() - bootedAt.current)}, 1 user, load average: 0.00, 0.01, 0.05`,
          },
        ]);
        break;
      case "uname":
        print([
          {
            text: args.some((a) => a.startsWith("-") && a.includes("a"))
              ? "divyansh.dev 6.9-mono #1 SMP x86_64 GNU/Linux (virtualized: your browser)"
              : "divyansh.dev",
          },
        ]);
        break;
      case "neofetch": {
        const art = [
          "        /\\        ",
          "       /  \\       ",
          "      /    \\      ",
          "     /  __  \\     ",
          "    /  |  |  \\    ",
          "   /___|  |___\\   ",
        ];
        const info = [
          "guest@divyansh.dev",
          "-----------------",
          "OS: divyansh.dev (browser)",
          "Uptime: " + prettyUptime(Date.now() - bootedAt.current),
          "Shell: guest@tsh",
          "Theme: monochrome-dark",
          "Shortcuts: ⌘K palette · ⌘` shell",
        ];
        print(
          Array.from({ length: Math.max(art.length, info.length) }, (_, i) => ({
            text: `${(art[i] ?? "              ").padEnd(24)}${info[i] ?? ""}`,
          })),
        );
        break;
      }
      case "history":
        if (history.length === 0) print([{ text: "history is empty", dim: true }]);
        else print(history.map((h, i) => ({ text: `  ${String(i + 1).padStart(3)}  ${h}` })));
        break;
      case "man": {
        const page = MAN_PAGES[(args[0] ?? "").toLowerCase()];
        print(page ?? [{ text: `No manual entry for ${args[0] ?? ""}`.trim(), dim: true }]);
        break;
      }
      case "ping": {
        const host = args[0] || "1.1.1.1";
        const out: Line[] = [
          { text: `PING ${host} (93.184.216.34) 56(84) bytes of data.`, dim: true },
        ];
        for (let i = 0; i < 4; i++) {
          out.push({
            text: `64 bytes from ${host}: icmp_seq=${i} ttl=64 time=${(0.3 + Math.random() * 6).toFixed(1)} ms`,
          });
        }
        out.push({ text: `--- ${host} ping statistics ---`, dim: true });
        out.push({ text: "4 packets transmitted, 4 received, 0% packet loss", dim: true });
        print(out);
        break;
      }
      case "cowsay":
        print(cowLines(args.join(" ")));
        break;
      case "ps":
        print([
          { text: "  PID  COMMAND              STATUS", dim: true },
          { text: "    1  portfolio --launch   running" },
          { text: "   42  matrix-rain          aesthetic" },
          { text: "  133  guest@terminal       reading your input" },
          { text: "  999  recruiter-detection always listening", dim: true },
        ]);
        break;
      case "apt":
        print([
          { text: "Reading package lists… Done", dim: true },
          {
            text: `E: Unable to locate package '${args.join(" ") || "job"}' — try 'sudo hire-me'`,
          },
        ]);
        break;
      case "vim":
      case "nano":
      case "emacs":
        print([
          {
            text: `${cmd}: this is a browser, not a datacenter — editors live elsewhere.`,
            dim: true,
          },
        ]);
        break;
      case "sl":
        print([
          { text: "  ===─────────────────  " },
          { text: "  === ▶─────────────────      (you typed sl instead of ls)" },
          { text: "   ──────────────────  " },
        ]);
        break;
      case "reboot":
        print([{ text: "Rebooting divyansh.dev…", dim: true }]);
        close();
        window.setTimeout(() => window.dispatchEvent(new Event("site-reboot")), 500);
        break;
      case "shutdown":
      case "poweroff":
        print([{ text: "shutdown: declining — the uptime streak is heroic.", dim: true }]);
        break;
      case "cat": {
        const f = (args[0] ?? "").replace(/^~\/|^\/|\/$/g, "").toLowerCase();
        if (f === "contact.txt" || f === "about.txt") {
          print([
            { text: `email: ${email}` },
            { text: `github: ${github}` },
            { text: "open your terminal of the web: ⌘K — search anything", dim: true },
          ]);
        } else if (f) {
          print([{ text: `cat: ${f}: No such file or directory`, dim: true }]);
        } else {
          print([{ text: "cat: missing operand — try cat ~/contact.txt", dim: true }]);
        }
        break;
      }
      case "shortcut":
      case "shortcuts":
        print([
          { text: "⌘K  toggle command palette" },
          { text: "⌘`  toggle this terminal" },
          { text: "esc minimize the focused window" },
        ]);
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
          close();
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
        close();
        break;
      default:
        print([{ text: `command not found: ${cmd} — try 'help'`, dim: true }]);
    }
  };

  return (
    <AnimatePresence>
      {open && !isMinimized && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className={`fixed inset-0 pointer-events-none ${isFocused ? "z-[96]" : "z-[94]"}`}
          role="presentation"
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Terminal"
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
            className={`pointer-events-auto absolute flex flex-col overflow-hidden bg-[#0b0b0d]/95 shadow-elegant ${
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
                aria-label="Close terminal"
                title="Close"
                className="group grid h-6 w-6 place-items-center rounded-full border border-white/10 bg-white/[0.04] text-muted-foreground transition-colors hover:border-red-400/40 hover:bg-red-500/25 hover:text-red-200"
              >
                <X size={11} />
              </button>
              <button
                type="button"
                onClick={minimize}
                aria-label="Minimize terminal"
                title="Minimize"
                className="group grid h-6 w-6 place-items-center rounded-full border border-white/10 bg-white/[0.04] text-muted-foreground transition-colors hover:border-amber-400/40 hover:bg-amber-500/25 hover:text-amber-200"
              >
                <Minus size={11} />
              </button>
              <button
                type="button"
                onClick={maximize}
                aria-label={isMaximized ? "Restore terminal" : "Maximize terminal"}
                title={isMaximized ? "Restore" : "Maximize"}
                className="group grid h-6 w-6 place-items-center rounded-full border border-white/10 bg-white/[0.04] text-muted-foreground transition-colors hover:border-emerald-400/40 hover:bg-emerald-500/25 hover:text-emerald-200"
              >
                {isMaximized ? <Minimize2 size={11} /> : <Square size={10} />}
              </button>
              <span className="ml-2 flex items-center gap-1.5 font-mono text-[11px] text-muted-foreground">
                <TerminalSquare size={13} /> guest@divyansh.dev
              </span>
              <span className="ml-auto hidden sm:block rounded-md border border-white/10 bg-white/[0.04] px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                ESC
              </span>
            </div>
            <div
              ref={scrollRef}
              className="min-h-0 flex-1 overflow-y-auto overflow-x-auto p-4 font-mono text-[13px] leading-relaxed"
            >
              {lines.map((l, i) => (
                <div
                  key={i}
                  className={
                    l.dim
                      ? "text-muted-foreground whitespace-pre"
                      : "text-foreground whitespace-pre"
                  }
                >
                  {l.text || " "}
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
                  onKeyDown={onInputKeyDown}
                  aria-label="Terminal input"
                  autoComplete="off"
                  autoCapitalize="off"
                  spellCheck={false}
                  placeholder="help"
                  className="w-full bg-transparent text-base sm:text-[13px] text-foreground outline-none placeholder:text-muted-foreground/50"
                />
              </form>
            </div>
            {!isMaximized && <ResizeHandles onResize={startResize} label="terminal" />}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
