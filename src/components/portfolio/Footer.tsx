import { useRef } from "react";
import { motion, useReducedMotion, useScroll, useTransform } from "motion/react";
import { ArrowUp, Github, Linkedin, Mail } from "lucide-react";
import { Magnetic } from "./Magnetic";
import { useISTClock } from "@/hooks/use-ist-clock";
import { useKindPresence, useSiteSettings } from "@/hooks/use-content";
import { isSectionVisible, type SectionId } from "@/lib/settings";
import { safeHref } from "@/lib/utils";

const DEFAULT_REPO = "https://github.com/divyanshakya966/divyansh.dev";
const DEFAULT_GITHUB = "https://github.com/divyanshakya966";
const DEFAULT_LINKEDIN = "https://www.linkedin.com/in/divyanshakya966";
const DEFAULT_EMAIL = "divyanshakya.dev@gmail.com";

const SITEMAP: { href: string; label: string; section: SectionId }[] = [
  { href: "#about", label: "About", section: "about" },
  { href: "#skills", label: "Skills", section: "skills" },
  { href: "#projects", label: "Projects", section: "projects" },
  { href: "#experience", label: "Experience", section: "experience" },
  { href: "#contact", label: "Contact", section: "contact" },
];

const PROOF: { href: string; label: string; section: SectionId }[] = [
  { href: "#certifications", label: "Certifications", section: "certifications" },
  { href: "#achievements", label: "Achievements", section: "achievements" },
  { href: "#building", label: "Building", section: "building" },
];

const CONDITIONAL_PROOF: {
  href: string;
  label: string;
  section: SectionId;
  kind: "research" | "blog";
}[] = [
  { href: "#research", label: "Research", section: "research", kind: "research" },
  { href: "#blogs", label: "Blogs", section: "blogs", kind: "blog" },
];

function useLocalTime() {
  return useISTClock();
}

export function Footer() {
  const { settings } = useSiteSettings();
  const repo = safeHref(settings.footer_repo ?? "", DEFAULT_REPO) || DEFAULT_REPO;
  const github = safeHref(settings.social_github ?? "", DEFAULT_GITHUB) || DEFAULT_GITHUB;
  const linkedin = safeHref(settings.social_linkedin ?? "", DEFAULT_LINKEDIN) || DEFAULT_LINKEDIN;
  const emailRaw = (settings.contact_email ?? "").trim();
  const email = emailRaw.includes("@") ? emailRaw : DEFAULT_EMAIL;
  const time = useLocalTime();
  // Never link to sections that render null (admin-hidden or, for
  // research/blogs, unpublished) — dead anchors break footer trust.
  const sitemap = SITEMAP.filter((l) => isSectionVisible(settings, l.section));
  const proof = PROOF.filter((l) => isSectionVisible(settings, l.section));
  const researchLive = useKindPresence("research");
  const blogsLive = useKindPresence("blog");
  const conditionalProof = CONDITIONAL_PROOF.filter(
    (l) =>
      isSectionVisible(settings, l.section) && (l.kind === "research" ? researchLive : blogsLive),
  );
  const footRef = useRef<HTMLElement>(null);
  const reduce = useReducedMotion();
  // Scrubbed rise: the watermark floats up as the footer enters,
  // settling back down when scrolling away.
  const { scrollYProgress } = useScroll({ target: footRef, offset: ["start end", "end end"] });
  const markY = useTransform(scrollYProgress, [0, 1], [56, 0]);
  const markOpacity = useTransform(scrollYProgress, [0, 1], [0.4, 1]);

  const toTop = () => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: 0, behavior: reduced ? "auto" : "smooth" });
  };

  return (
    <footer ref={footRef} className="border-t border-white/10 mt-10 overflow-hidden">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 pt-12">
        <div className="grid gap-10 md:grid-cols-[1.5fr_1fr_1fr_1fr]">
          <div>
            <a href="#top" className="flex items-center gap-2 font-mono text-sm font-semibold">
              <span className="inline-block h-2 w-2 rounded-full bg-white animate-pulse" />
              <span className="text-gradient">divyansh.dev</span>
            </a>
            <p className="mt-4 max-w-xs text-sm text-muted-foreground leading-relaxed">
              Aspiring Security Engineer — building secure, scalable systems across DevSecOps, Linux
              and Cloud.
            </p>
            <p className="mt-3 font-mono text-[11px] text-muted-foreground">
              Crafting open-source software. Feel free to star the repo on{" "}
              <a
                href={repo}
                target="_blank"
                rel="noopener noreferrer"
                className="text-foreground hover:underline underline-offset-4"
              >
                GitHub
              </a>
              !
            </p>
            <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 font-mono text-[11px] tabular-nums text-muted-foreground">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full rounded-full bg-white opacity-75 animate-ping" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-white" />
              </span>
              AVAILABLE · {time}
            </div>
            <div className="mt-5 flex gap-2">
              {[
                { href: github, label: "GitHub", Icon: Github },
                { href: linkedin, label: "LinkedIn", Icon: Linkedin },
                { href: `mailto:${email}`, label: "Email", Icon: Mail },
              ].map(({ href, label, Icon }) => (
                <a
                  key={label}
                  href={href}
                  target={href.startsWith("mailto:") ? undefined : "_blank"}
                  rel={href.startsWith("mailto:") ? undefined : "noreferrer noopener"}
                  aria-label={label}
                  className="grid place-items-center h-9 w-9 rounded-lg border border-white/10 text-muted-foreground transition-colors hover:border-white/25 hover:bg-white/[0.05] hover:text-foreground"
                >
                  <Icon size={15} />
                </a>
              ))}
            </div>
          </div>

          <nav aria-label="Sitemap">
            <h3 className="font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
              Sitemap
            </h3>
            <ul className="mt-4 space-y-2.5 text-sm">
              {sitemap.map((l) => (
                <li key={l.href}>
                  <a
                    href={l.href}
                    className="text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {l.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          <nav aria-label="Proof">
            <h3 className="font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
              Proof
            </h3>
            <ul className="mt-4 space-y-2.5 text-sm">
              {proof.map((l) => (
                <li key={l.href}>
                  <a
                    href={l.href}
                    className="text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {l.label}
                  </a>
                </li>
              ))}
              {conditionalProof.map((l) => (
                <li key={l.href}>
                  <a
                    href={l.href}
                    className="text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {l.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          <div>
            <h3 className="font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
              Connect
            </h3>
            <ul className="mt-4 space-y-2.5 text-sm">
              <li>
                <a
                  href={`mailto:${email}`}
                  className="break-all text-muted-foreground transition-colors hover:text-foreground"
                >
                  {email}
                </a>
              </li>
              <li>
                <a
                  href="/resume/Divyansh_Shakya_Resume_Digital.pdf"
                  target="_blank"
                  rel="noreferrer noopener"
                  className="text-muted-foreground transition-colors hover:text-foreground"
                >
                  Resume ↓
                </a>
              </li>
              <li>
                <button
                  onClick={() => window.dispatchEvent(new Event("open-command-palette"))}
                  className="font-mono text-xs text-muted-foreground transition-colors hover:text-foreground"
                >
                  ⌘K quick nav
                </button>
              </li>
            </ul>
            <Magnetic strength={0.3} max={10} className="mt-5">
              <motion.button
                onClick={toTop}
                whileHover={{ scale: 1.04, y: -2 }}
                whileTap={{ scale: 0.94 }}
                aria-label="Back to top"
                className="inline-flex items-center gap-2 rounded-xl glass px-3.5 py-2.5 text-xs font-medium hover:border-white/25 hover:shadow-glow transition-colors"
              >
                <ArrowUp size={14} /> Top
              </motion.button>
            </Magnetic>
          </div>
        </div>

        <motion.div
          aria-hidden="true"
          style={reduce ? undefined : { y: markY, opacity: markOpacity }}
          className="mt-12 select-none text-center"
        >
          <div className="font-bold tracking-tight leading-none text-[13vw] sm:text-[8vw] lg:text-[6rem] text-white/[0.05] hover:text-white/[0.1] transition-colors duration-500">
            DIVYANSH.DEV
          </div>
        </motion.div>

        <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-2 border-t border-white/10 py-5 font-mono text-[11px] tabular-nums text-muted-foreground">
          <div>© {new Date().getFullYear()} Divyansh Shakya</div>
          <div>{"// built with intent · Bhopal, IN · " + time}</div>
        </div>
      </div>
      <div style={{ paddingBottom: "max(env(safe-area-inset-bottom), 0.5rem)" }} />
    </footer>
  );
}
