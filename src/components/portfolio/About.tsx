import { Section } from "./Section";
import { Shield, Cloud, Code2, Terminal } from "lucide-react";

const cards = [
  {
    icon: Shield,
    title: "Security First",
    body: "Aspiring security engineer — DevSecOps, pentesting and AI security via hands-on TryHackMe and HackTheBox labs.",
  },
  {
    icon: Cloud,
    title: "Cloud & DevSecOps",
    body: "Docker, Kubernetes, CI/CD and cloud security fundamentals — shipping safer, faster.",
  },
  {
    icon: Code2,
    title: "Builder",
    body: "Full-stack apps, Discord & Telegram bots, and DevSecOps tooling — JS/TS, C/C++, Python.",
  },
  {
    icon: Terminal,
    title: "Linux Native",
    body: "Lives in the terminal — Git/GitHub workflows, scripting, and constant tinkering.",
  },
];

export function About() {
  return (
    <Section
      id="about"
      eyebrow="01 / About"
      title={
        <>
          Aspiring security engineer building <span className="text-gradient">secure systems</span>.
        </>
      }
      description="I'm Divyansh — a B.Tech CSE (Cybersecurity) student at Oriental College of Technology, Bhopal. I'm passionate about Linux, DevSecOps, AI & cloud security, and I learn by building, breaking and shipping."
    >
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((c, i) => (
          <div
            key={c.title}
            className="reveal card-hover glass rounded-2xl p-5 hover:shadow-glow hover:-translate-y-1"
            style={{ transitionDelay: `${i * 60}ms` }}
          >
            <div className="grid place-items-center h-10 w-10 rounded-xl bg-gradient-to-br from-cyan/20 to-violet/20 border border-border">
              <c.icon size={18} className="text-foreground" />
            </div>
            <h3 className="mt-4 font-semibold">{c.title}</h3>
            <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed">{c.body}</p>
          </div>
        ))}
      </div>
    </Section>
  );
}
