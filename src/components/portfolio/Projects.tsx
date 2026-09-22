import { useState } from "react";
import { Section } from "./Section";
import { Github, ExternalLink } from "lucide-react";
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
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
        {projects.map((p, i) => (
          <article
            key={p.id}
            role="button"
            tabIndex={0}
            aria-haspopup="dialog"
            aria-label={`View details about ${p.title}`}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                setOpen(p);
              }
            }}
            className="reveal card-hover group relative glass rounded-2xl p-6 cursor-pointer hover:-translate-y-1 hover:shadow-glow overflow-hidden outline-none focus-visible:ring-2 focus-visible:ring-ring"
            style={{ transitionDelay: `${i * 60}ms` }}
            onClick={() => setOpen(p)}
          >
            <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none bg-gradient-to-br from-cyan/[0.06] via-transparent to-violet/[0.08]" />
            <div className="relative">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                  {p.tag}
                </span>
                <div className="flex gap-1.5">
                  {p.github && (
                    <a
                      href={p.github}
                      target="_blank"
                      rel="noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="grid place-items-center h-7 w-7 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                      aria-label="GitHub"
                    >
                      <Github size={13} />
                    </a>
                  )}
                  {p.demo && (
                    <a
                      href={p.demo}
                      target="_blank"
                      rel="noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="grid place-items-center h-7 w-7 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                      aria-label="Live"
                    >
                      <ExternalLink size={13} />
                    </a>
                  )}
                </div>
              </div>
              <h3 className="mt-4 text-xl font-semibold">{p.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed line-clamp-3">
                {p.description}
              </p>
              <div className="mt-5 flex flex-wrap gap-1.5">
                {p.stack.map((s) => (
                  <span
                    key={s}
                    className="rounded-md border border-border bg-muted/40 px-2 py-0.5 text-[10px] font-mono text-muted-foreground"
                  >
                    {s}
                  </span>
                ))}
              </div>
            </div>
          </article>
        ))}
      </div>

      <Dialog open={!!open} onOpenChange={(isOpen) => setOpen(isOpen ? open : null)}>
        <DialogContent className="max-w-lg max-h-85-viewport overflow-y-auto border-border/60 bg-card/70 backdrop-blur-md sm:rounded-2xl shadow-elegant">
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
        </DialogContent>
      </Dialog>
    </Section>
  );
}
