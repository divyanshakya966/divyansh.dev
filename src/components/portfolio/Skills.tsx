import { Section } from "./Section";

const groups = [
  {
    title: "Languages",
    items: ["JavaScript", "TypeScript", "C", "C++", "Python", "Bash"],
  },
  {
    title: "Web & Backend",
    items: ["Node.js", "Express.js", "React", "REST APIs", "MongoDB"],
  },
  {
    title: "DevSecOps & Cloud",
    items: ["Linux", "Docker", "Kubernetes", "Git & GitHub", "CI/CD", "Cloud Security"],
  },
  {
    title: "Security",
    items: ["DevSecOps", "Pentesting", "Web App Security", "AI Security", "Recon", "TryHackMe"],
  },
];

export function Skills() {
  return (
    <Section
      id="skills"
      eyebrow="02 / Skills"
      title={<>The toolkit, <span className="text-gradient">organized</span>.</>}
      description="A focused stack across web, systems and security."
    >
      <div className="grid md:grid-cols-2 gap-4">
        {groups.map((g, gi) => (
          <div
            key={g.title}
            className="reveal glass rounded-2xl p-6 hover:shadow-elegant transition-all duration-300"
            style={{ transitionDelay: `${gi * 80}ms` }}
          >
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">{g.title}</h3>
              <span className="font-mono text-xs text-muted-foreground">0{gi + 1}</span>
            </div>
            <div className="mt-5 flex flex-wrap gap-2">
              {g.items.map((s) => (
                <span
                  key={s}
                  className="group relative inline-flex items-center gap-1.5 rounded-lg border border-border bg-muted/40 px-2.5 py-1.5 text-xs font-mono hover:border-primary/50 hover:text-foreground hover:-translate-y-0.5 transition-all cursor-default"
                >
                  <span className="h-1 w-1 rounded-full bg-gradient-to-r from-cyan to-violet" />
                  {s}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </Section>
  );
}
