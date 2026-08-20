import { Section } from "./Section";

const items = [
  {
    when: "August 2026 – Present",
    title: "Cybersecurity Trainee",
    where: "HackTheBox",
    body: "Doing hands-on cybersecurity training on HackTheBox across red teaming and penetration testing with continuously advancing skills through ongoing labs/machines and challenges.",
    tag: "Cybersecurity",
  },
  {
    when: "May 2026 – July 2026",
    title: "Open Source Contributor",
    where: "GSSoC 2026",
    body: "Contributing code, documentation, testing and feature improvements across open-source projects. Collaborating with maintainers via Git, GitHub, issues and PRs.",
    tag: "Open Source",
  },
  {
    when: "Apr 2026 – Present",
    title: "National Hackathon Finalist · 2x",
    where: "National Level Hackathons",
    body: "Reached the finals at two national-level student hackathons — shipping secure, full-stack prototypes under tight deadlines with cross-functional teams.",
    tag: "Hackathon",
  },
  {
    when: "Feb 2026 – Present",
    title: "Security Trainee",
    where: "TryHackMe",
    body: "Hands-on training across DevSecOps, security engineering, AI security, penetration testing and web application security. Active labs in reconnaissance, vulnerability assessment and controlled exploitation.",
    tag: "Cybersecurity",
  },
  {
    when: "2025 – Present",
    title: "B.Tech CSE — Cybersecurity",
    where: "Oriental College of Technology, Bhopal",
    body: "Pursuing Bachelor of Technology in Computer Science with a Cybersecurity specialization. Focusing on Linux, systems, secure software and cloud security fundamentals.",
    tag: "Education",
  },
];

export function Experience() {
  return (
    <Section
      id="experience"
      eyebrow="04 / Experience"
      title={
        <>
          Training, <span className="text-gradient">open source</span> & hackathons.
        </>
      }
    >
      <div className="relative">
        <div className="absolute left-4 sm:left-1/2 sm:-translate-x-px top-0 bottom-0 w-px bg-gradient-to-b from-transparent via-border to-transparent" />
        <ul className="space-y-10">
          {items.map((it, i) => (
            <li key={it.title} className="reveal relative grid sm:grid-cols-2 gap-6 sm:gap-12">
              <div
                className={`pl-12 sm:pl-0 ${
                  i % 2 === 0 ? "sm:order-1 sm:text-right sm:pr-12" : "sm:order-2 sm:pl-12"
                }`}
              >
                <div className="absolute left-4 sm:left-1/2 -translate-x-1/2 top-2 h-3 w-3 rounded-full bg-gradient-to-br from-cyan to-violet ring-4 ring-background" />
                <div className="font-mono text-xs text-muted-foreground">
                  {it.when} · {it.tag}
                </div>
                <h3 className="mt-1 text-lg font-semibold">{it.title}</h3>
                <div className="text-sm text-muted-foreground">{it.where}</div>
              </div>
              <div
                className={`pl-12 sm:pl-0 ${
                  i % 2 === 0 ? "sm:order-2 sm:pl-12" : "sm:order-1 sm:text-right sm:pr-12"
                }`}
              >
                <p className="text-sm text-muted-foreground leading-relaxed">{it.body}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </Section>
  );
}
