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
import { site } from "@/lib/site";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: site.title },
      { name: "description", content: site.description },
      { property: "og:title", content: site.title },
      { property: "og:description", content: site.description },
      { property: "og:url", content: site.url },
      { property: "og:type", content: "website" },
      { property: "og:image", content: site.url + site.image },
      { property: "og:image:alt", content: site.imageAlt },
      { name: "twitter:title", content: site.title },
      { name: "twitter:description", content: site.description },
      { name: "twitter:image", content: site.url + site.image },
      { name: "twitter:image:alt", content: site.imageAlt },
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
