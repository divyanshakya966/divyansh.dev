import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowUp, FileText, Mail } from "lucide-react";
import { useSiteSettings } from "@/hooks/use-content";

const DEFAULT_EMAIL = "divyanshakya.dev@gmail.com";
const RESUME_HREF = "/resume/Divyansh_Shakya_Resume_Digital.pdf";
const RING_C = 2 * Math.PI * 14;

export function RightPanel() {
  const [scrollPct, setScrollPct] = useState(0);
  const [showTop, setShowTop] = useState(false);
  const { settings } = useSiteSettings();
  const emailRaw = (settings.contact_email ?? "").trim();
  const email = emailRaw.includes("@") ? emailRaw : DEFAULT_EMAIL;
  const links = [
    { name: "Email", href: `mailto:${email}`, icon: <Mail size={16} /> },
    { name: "Resume", href: RESUME_HREF, icon: <FileText size={16} /> },
  ];

  useEffect(() => {
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const { scrollHeight, clientHeight } = document.documentElement;
        const max = scrollHeight - clientHeight;
        const pct = max > 0 ? Math.round((window.scrollY / max) * 100) : 0;
        setScrollPct(pct);
        setShowTop(window.scrollY > 600);
      });
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <motion.aside
      aria-label="Contact and status"
      initial={{ opacity: 0, x: 18 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 1.4, duration: 0.6, ease: "easeOut" }}
      className="hidden xl:flex fixed right-[max(1rem,env(safe-area-inset-right))] top-1/2 -translate-y-1/2 z-40 flex-col items-center gap-1 rounded-2xl glass p-1.5"
    >
      {links.map((l, i) => (
        <motion.a
          key={l.name}
          href={l.href}
          target={l.href.startsWith("mailto:") ? undefined : "_blank"}
          rel={l.href.startsWith("mailto:") ? undefined : "noopener noreferrer"}
          aria-label={l.name}
          title={l.name}
          initial={{ opacity: 0, x: 10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 1.5 + i * 0.05, duration: 0.35 }}
          whileHover={{ scale: 1.14, x: -2 }}
          whileTap={{ scale: 0.88 }}
          className="group relative grid place-items-center h-9 w-9 rounded-lg bg-transparent text-muted-foreground hover:text-foreground hover:bg-foreground/6 transition-colors"
        >
          <span className="pointer-events-none absolute right-full mr-2 whitespace-nowrap rounded-md glass px-2 py-1 font-mono text-[10px] uppercase tracking-widest text-foreground opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all">
            {l.name}
          </span>
          {l.icon}
        </motion.a>
      ))}

      <div className="my-1 h-px w-6 bg-border" aria-hidden="true" />

      {/* circular scroll progress */}
      <div
        className="relative grid place-items-center h-9 w-9"
        title="Scroll progress"
        aria-label={`${scrollPct}% scrolled`}
      >
        <svg viewBox="0 0 36 36" className="absolute inset-0 h-full w-full -rotate-90">
          <circle
            cx="18"
            cy="18"
            r="14"
            fill="none"
            strokeWidth="2.5"
            className="stroke-white/10"
          />
          <motion.circle
            cx="18"
            cy="18"
            r="14"
            fill="none"
            strokeWidth="2.5"
            strokeLinecap="round"
            className="stroke-white/80"
            strokeDasharray={RING_C}
            animate={{ strokeDashoffset: RING_C * (1 - scrollPct / 100) }}
            transition={{ type: "spring", stiffness: 120, damping: 20 }}
          />
        </svg>
        <span className="font-mono text-[9px] text-muted-foreground tabular-nums">
          {scrollPct}%
        </span>
      </div>

      {/* back to top — appears after scrolling */}
      <AnimatePresence>
        {showTop && (
          <motion.a
            href="#top"
            aria-label="Back to top"
            title="Back to top"
            initial={{ opacity: 0, scale: 0.6, y: 6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.6, y: 6 }}
            whileHover={{ scale: 1.14, y: -2 }}
            whileTap={{ scale: 0.88 }}
            className="grid place-items-center h-9 w-9 rounded-lg border border-white/15 bg-white/[0.06] text-foreground shadow-glow"
          >
            <ArrowUp size={15} />
          </motion.a>
        )}
      </AnimatePresence>
    </motion.aside>
  );
}
