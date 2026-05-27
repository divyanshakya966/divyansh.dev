import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Toaster } from "@/components/ui/sonner";
import { Nav } from "@/components/portfolio/Nav";
import { BackgroundFX } from "@/components/portfolio/BackgroundFX";
import { Cursor } from "@/components/portfolio/Cursor";
import { IntroBoot } from "@/components/portfolio/IntroBoot";
import { Hero } from "@/components/portfolio/Hero";
import { About } from "@/components/portfolio/About";
import { Skills } from "@/components/portfolio/Skills";
import { Projects } from "@/components/portfolio/Projects";
import { Experience } from "@/components/portfolio/Experience";
import { Achievements } from "@/components/portfolio/Achievements";
import { Building } from "@/components/portfolio/Building";
import { Contact } from "@/components/portfolio/Contact";
import { Footer } from "@/components/portfolio/Footer";
import { useReveal } from "@/hooks/use-reveal";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Divyansh Shakya | Cybersecurity Student & Developer" },
      {
        name: "description",
        content:
          "Portfolio of Divyansh Shakya — B.Tech CSE (Cybersecurity) student focused on AI & Cloud Security, ethical hacking and full-stack web development.",
      },
      { property: "og:title", content: "Divyansh Shakya | Cybersecurity Student & Developer" },
      { property: "og:description", content: "Cybersecurity, Cloud, and full-stack — projects, hackathons and open source." },
      { property: "og:type", content: "website" },
    ],
  }),
  component: Index,
});

function Index() {
  const [bootClosing, setBootClosing] = useState(false);
  const [bootDone, setBootDone] = useState(false);
  useReveal(bootClosing);
  return (
    <main className="relative min-h-screen">
      <BackgroundFX />
      <Cursor />
      {!bootDone && <IntroBoot onCloseStart={() => setBootClosing(true)} onDone={() => setBootDone(true)} />}
      <Nav />
      <Hero booted={bootClosing} />
      <About />
      <Skills />
      <Projects />
      <Experience />
      <Achievements />
      <Building />
      <Contact />
      <Footer />
      <Toaster richColors position="bottom-right" />
    </main>
  );
}
