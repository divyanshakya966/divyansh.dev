import { useState } from "react";
import { Section } from "./Section";
import { Github, ExternalLink, X } from "lucide-react";

type Project = {
  title: string;
  description: string;
  long: string;
  stack: string[];
  github?: string;
  demo?: string;
  tag: string;
};

const projects: Project[] = [
  {
    title: "AegisStack",
    tag: "DevSecOps",
    description: "A DevSecOps assistant that helps developers shift security left across the pipeline.",
    long: "AegisStack is a DevSecOps assistant focused on baking security into every stage of the software delivery pipeline — dependency scanning, secret detection, container hardening checks, and policy-as-code guidance. Designed to give developers actionable, contextual security feedback without slowing them down.",
    stack: ["Python", "Docker", "K8s", "DevSecOps"],
    github: "https://github.com/divyanshakya966",
  },
  {
    title: "Discord AI ChatBot",
    tag: "Bots / AI",
    description: "Multipurpose Discord bot with AI chat, moderation utilities and server commands.",
    long: "A multipurpose Discord bot built with Node.js — AI-powered conversational responses, slash commands, moderation utilities, and quality-of-life server tools. Modular command architecture, easy to extend.",
    stack: ["Node.js", "TypeScript", "discord.js", "OpenAI"],
    github: "https://github.com/divyanshakya966",
  },
  {
    title: "SmartCampus",
    tag: "Full Stack",
    description: "A campus marketplace where students can buy, sell and exchange items safely.",
    long: "SmartCampus is a closed-campus marketplace: verified student accounts, listings with images, chat, and a clean mobile-first UX. Built to solve a real problem on my own campus — secure, simple, and fast.",
    stack: ["Node.js", "Express", "MongoDB", "React"],
    github: "https://github.com/divyanshakya966",
  },
  {
    title: "Telegram Mod Bot",
    tag: "Bots",
    description: "Group moderation bot for Telegram — anti-spam, warnings, and admin tooling.",
    long: "A Telegram group moderation bot covering anti-spam filters, warning/ban systems, welcome flows, and admin utilities. Lightweight, configurable, and easy to self-host.",
    stack: ["Python", "python-telegram-bot", "Docker"],
    github: "https://github.com/divyanshakya966",
  },
];

export function Projects() {
  const [open, setOpen] = useState<Project | null>(null);

  return (
    <Section
      id="projects"
      eyebrow="03 / Projects"
      title={<>Selected <span className="text-gradient">work</span>.</>}
      description="DevSecOps tooling, bots and full-stack apps I've shipped or am actively building."
    >
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
        {projects.map((p, i) => (
          <article
            key={p.title}
            className="reveal group relative glass rounded-2xl p-6 cursor-pointer hover:-translate-y-1 hover:shadow-glow transition-all duration-300 overflow-hidden"
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

      {open && (
        <div
          className="fixed inset-0 z-[60] grid place-items-center p-4 bg-background/70 backdrop-blur-md animate-fade-in"
          onClick={() => setOpen(null)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="relative max-w-lg w-full glass rounded-2xl p-7 shadow-elegant"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setOpen(null)}
              className="absolute top-4 right-4 grid place-items-center h-8 w-8 rounded-md hover:bg-muted"
              aria-label="Close"
            >
              <X size={16} />
            </button>
            <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
              {open.tag}
            </span>
            <h3 className="mt-2 text-2xl font-bold">{open.title}</h3>
            <p className="mt-3 text-sm text-muted-foreground leading-relaxed">{open.long}</p>
            <div className="mt-5 flex flex-wrap gap-1.5">
              {open.stack.map((s) => (
                <span
                  key={s}
                  className="rounded-md border border-border bg-muted/40 px-2 py-0.5 text-[10px] font-mono text-muted-foreground"
                >
                  {s}
                </span>
              ))}
            </div>
            <div className="mt-6 flex gap-2">
              {open.github && (
                <a
                  href={open.github}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm glass hover:bg-muted"
                >
                  <Github size={14} /> Source
                </a>
              )}
              {open.demo && (
                <a
                  href={open.demo}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm bg-gradient-to-r from-cyan to-violet text-primary-foreground"
                >
                  <ExternalLink size={14} /> Live
                </a>
              )}
            </div>
          </div>
        </div>
      )}
    </Section>
  );
}
