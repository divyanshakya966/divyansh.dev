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
      { title: "Divyansh Shakya — Cybersecurity Student & Developer" },
      {
        name: "description",
        content:
          "Portfolio of Divyansh Shakya — B.Tech CSE (Cybersecurity) student focused on Linux, low-level systems, ethical hacking and full-stack web development.",
      },
      { property: "og:title", content: "Divyansh Shakya — Cybersecurity Student & Developer" },
      { property: "og:description", content: "Cybersecurity, Linux, and full-stack — projects, hackathons and open source." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  useReveal();
  const [booted, setBooted] = useState(false);
  return (
    <main className="relative min-h-screen">
      <BackgroundFX />
      <Cursor />
      {!booted && <IntroBoot onDone={() => setBooted(true)} />}
      <Nav />
      <Hero />
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
