import { useEffect, useState } from "react";
import { FileText, Mail } from "lucide-react";

const links = [
  {
    name: "Email",
    href: "mailto:divyanshakya.dev@gmail.com",
    icon: <Mail size={16} />,
  },
  {
    name: "Resume",
    href: "/resume/Divyansh_Shakya_Resume_Digital.pdf",
    icon: <FileText size={16} />,
  },
];

export function RightPanel() {
  const [scrollPct, setScrollPct] = useState(0);

  useEffect(() => {
    const onScroll = () => {
      const { scrollHeight, clientHeight } = document.documentElement;
      const max = scrollHeight - clientHeight;
      setScrollPct(max > 0 ? Math.round((window.scrollY / max) * 100) : 0);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <aside
      aria-label="Contact and status"
      className="hidden xl:flex fixed right-[max(1rem,env(safe-area-inset-right))] top-1/2 -translate-y-1/2 z-40 flex-col items-center gap-1 rounded-2xl glass p-1.5"
    >
      {links.map((l) => (
        <a
          key={l.name}
          href={l.href}
          target={l.href.startsWith("mailto:") ? undefined : "_blank"}
          rel={l.href.startsWith("mailto:") ? undefined : "noopener noreferrer"}
          aria-label={l.name}
          title={l.name}
          className="group relative grid place-items-center h-9 w-9 rounded-lg bg-transparent text-muted-foreground hover:text-foreground hover:bg-foreground/6 transition"
        >
          <span className="pointer-events-none absolute right-full mr-2 whitespace-nowrap rounded-md glass px-2 py-1 font-mono text-[10px] uppercase tracking-widest text-foreground opacity-0 group-hover:opacity-100 transition-opacity">
            {l.name}
          </span>
          {l.icon}
        </a>
      ))}

      <div className="mt-1 h-px w-6 bg-border" />

      <div
        className="grid place-items-center h-9 w-9"
        title="Scroll progress"
        aria-label={`${scrollPct}% scrolled`}
      >
        <span className="font-mono text-[10px] text-muted-foreground tabular-nums">
          {scrollPct}%
        </span>
      </div>
    </aside>
  );
}
