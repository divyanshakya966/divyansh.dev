import { useState } from "react";
import { motion } from "motion/react";
import { Section } from "./Section";
import { Reveal } from "./Reveal";
import { ArrowUpRight, Github, ExternalLink } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { usePublicContent, useSiteSettings } from "@/hooks/use-content";
import { isSectionVisible } from "@/lib/settings";
import { safeHref } from "@/lib/utils";
import type { ContentItem } from "@/lib/content";

type Project = {
  id: string;
  title: string;
  description: string;
  long: string;
  stack: string[];
  github?: string;
  demo?: string;
  tag: string;
};

function toProject(item: ContentItem): Project {
  const meta = item.meta ?? {};
  const long = typeof meta.long === "string" && meta.long.trim() ? meta.long : item.description;
  // meta.demo is free-form admin input — only render safe http(s) URLs.
  const demoRaw = typeof meta.demo === "string" ? meta.demo : "";
  const demo = safeHref(demoRaw) || undefined;
  return {
    id: String(item.id),
    title: item.title,
    description: item.description,
    long,
    stack: item.tags,
    github: item.url || undefined,
    demo,
    tag: item.subtitle,
  };
}

export function Projects() {
  const { items } = usePublicContent("project");
  const { settings } = useSiteSettings();
  const [open, setOpen] = useState<Project | null>(null);

  if (!isSectionVisible(settings, "projects") || items.length === 0) return null;
  const projects = items.map(toProject);

  return (
    <Section
      id="projects"
      eyebrow="03 / Projects"
      title={
        <>
          Selected <span className="text-gradient">work</span>.
        </>
      }
      description="DevSecOps tooling, bots and full-stack apps I've shipped or am actively building."
    >
      <div className="border-t border-white/10">
        {projects.map((p, i) => (
          <Reveal key={p.id} variant="up" delay={Math.min(i * 0.05, 0.3)}>
            <article
              role="button"
              tabIndex={0}
              aria-haspopup="dialog"
              aria-label={`View details about ${p.title}`}
              data-cursor="view"
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setOpen(p);
                }
              }}
              onClick={() => setOpen(p)}
              className="group relative grid grid-cols-[auto_1fr_auto] items-start sm:items-center gap-3 sm:gap-6 border-b border-white/10 px-2 sm:px-4 py-5 sm:py-6 cursor-pointer outline-none transition-colors duration-300 hover:bg-white/[0.03] focus-visible:bg-white/[0.03] focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span className="pt-1 sm:pt-0 font-mono text-xs text-muted-foreground tabular-nums">
                {String(i + 1).padStart(2, "0")}
              </span>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                    {p.tag}
                  </span>
                  <span className="hidden sm:inline h-px w-6 bg-white/15" aria-hidden="true" />
                  <span className="hidden md:inline font-mono text-[11px] text-muted-foreground/70 truncate">
                    {p.stack.slice(0, 3).join(" · ")}
                  </span>
                </div>
                <h3 className="mt-1.5 text-lg sm:text-2xl font-semibold tracking-tight transition-transform duration-300 group-hover:translate-x-1">
                  {p.title}
                </h3>
                <p className="mt-1 text-sm text-muted-foreground leading-relaxed line-clamp-2 max-w-2xl">
                  {p.description}
                </p>
                <div className="mt-3 flex flex-wrap gap-1.5 md:hidden">
                  {p.stack.slice(0, 4).map((s) => (
                    <span
                      key={s}
                      className="rounded-md border border-white/10 bg-white/[0.03] px-2 py-0.5 font-mono text-[10px] text-muted-foreground"
                    >
                      {s}
                    </span>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-1.5 pt-1 sm:pt-0">
                {p.github && (
                  <a
                    href={p.github}
                    target="_blank"
                    rel="noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    aria-label="GitHub"
                    className="grid place-items-center h-8 w-8 rounded-lg border border-transparent text-muted-foreground transition-colors hover:border-white/15 hover:bg-white/[0.05] hover:text-foreground"
                  >
                    <Github size={14} />
                  </a>
                )}
                {p.demo && (
                  <a
                    href={p.demo}
                    target="_blank"
                    rel="noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    aria-label="Live"
                    className="grid place-items-center h-8 w-8 rounded-lg border border-transparent text-muted-foreground transition-colors hover:border-white/15 hover:bg-white/[0.05] hover:text-foreground"
                  >
                    <ExternalLink size={14} />
                  </a>
                )}
                <span className="grid place-items-center h-8 w-8 rounded-full border border-white/10 text-muted-foreground transition-all duration-300 group-hover:border-white/30 group-hover:bg-white group-hover:text-black">
                  <ArrowUpRight
                    size={14}
                    className="transition-transform duration-300 group-hover:translate-x-[1px] group-hover:-translate-y-[1px]"
                  />
                </span>
              </div>
            </article>
          </Reveal>
        ))}
      </div>
      <p className="mt-4 font-mono text-[11px] text-muted-foreground">
        {"~/ click a row for details — GitHub icons open source directly"}
      </p>

      <Dialog open={!!open} onOpenChange={(isOpen) => setOpen(isOpen ? open : null)}>
        <DialogContent className="max-w-lg max-h-85-viewport overflow-y-auto border-border/60 bg-card/70 backdrop-blur-md sm:rounded-2xl shadow-elegant">
          <motion.div
            initial={{ opacity: 0, y: 18, scale: 0.96, filter: "blur(10px)" }}
            animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
            transition={{ type: "spring", stiffness: 300, damping: 28, mass: 0.6 }}
          >
            <DialogHeader className="text-left">
              <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                {open?.tag}
              </span>
              <DialogTitle className="text-2xl font-bold tracking-tight mt-2">
                {open?.title}
              </DialogTitle>
            </DialogHeader>
            <DialogDescription className="text-left text-sm text-muted-foreground leading-relaxed">
              {open?.long}
            </DialogDescription>
            <div className="flex flex-wrap gap-1.5">
              {(open?.stack ?? []).map((s) => (
                <span
                  key={s}
                  className="rounded-md border border-border bg-muted/40 px-2 py-0.5 text-[10px] font-mono text-muted-foreground"
                >
                  {s}
                </span>
              ))}
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {open?.github && (
                <a
                  href={open.github}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm glass hover:bg-muted"
                >
                  <Github size={14} /> Source
                </a>
              )}
              {open?.demo && (
                <a
                  href={open.demo}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm bg-gradient-to-r from-cyan to-violet text-primary-foreground"
                >
                  <ExternalLink size={14} /> Live
                </a>
              )}
            </div>
          </motion.div>
        </DialogContent>
      </Dialog>
    </Section>
  );
}
