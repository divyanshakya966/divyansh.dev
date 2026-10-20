import { createFileRoute } from "@tanstack/react-router";
import { Suspense, lazy, useCallback, useEffect, useLayoutEffect, useState } from "react";
import { Toaster } from "@/components/ui/sonner";
import { Nav } from "@/components/portfolio/Nav";
import { AnalyticsBeacon } from "@/components/portfolio/AnalyticsBeacon";
import { Terminal } from "@/components/portfolio/Terminal";
import { useHireMeEgg } from "@/hooks/use-hire-me-egg";
import { SocialPanel } from "@/components/portfolio/SocialPanel";
import { RightPanel } from "@/components/portfolio/RightPanel";
import { BackgroundFX } from "@/components/portfolio/BackgroundFX";
import { Cursor } from "@/components/portfolio/Cursor";
import { WindowScrim } from "@/components/portfolio/WindowScrim";
import { IntroBoot } from "@/components/portfolio/IntroBoot";
import { Hero } from "@/components/portfolio/Hero";
import { About } from "@/components/portfolio/About";
import { Skills } from "@/components/portfolio/Skills";
import { Projects } from "@/components/portfolio/Projects";
import { Experience } from "@/components/portfolio/Experience";
import { Achievements } from "@/components/portfolio/Achievements";
import { Certifications } from "@/components/portfolio/Certifications";
import { Research } from "@/components/portfolio/Research";
import { Blogs } from "@/components/portfolio/Blogs";
import { Testimonials } from "@/components/portfolio/Testimonials";
import { Building } from "@/components/portfolio/Building";
import { Contact } from "@/components/portfolio/Contact";
import { Footer } from "@/components/portfolio/Footer";
import { useReveal } from "@/hooks/use-reveal";
import { site } from "@/lib/site";

// Below-the-fold interactive shell — split out so first paint stays lean.
const CommandPalette = lazy(() =>
  import("@/components/portfolio/CommandPalette").then((m) => ({ default: m.CommandPalette })),
);

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

// Runs before paint on the client (repeats never flash the boot screen);
// passive effect on the server, where layout effects don't run.
const useBeforePaint = typeof window !== "undefined" ? useLayoutEffect : useEffect;

function Index() {
  useHireMeEgg();
  const [bootClosing, setBootClosing] = useState(false);
  const [bootDone, setBootDone] = useState(false);
  const handleBootCloseStart = useCallback(() => setBootClosing(true), []);
  const handleBootDone = useCallback(() => {
    try {
      window.sessionStorage.setItem("ds-boot-seen", "1");
    } catch {
      // ignore storage failures
    }
    setBootDone(true);
  }, []);

  // Play the boot animation once per session; skip it on reloads/back-nav.
  // Checked before paint so reloads never flash the boot screen.
  useBeforePaint(() => {
    let seen = false;
    try {
      seen = window.sessionStorage.getItem("ds-boot-seen") === "1";
    } catch {
      // ignore storage failures
    }
    if (seen) {
      setBootClosing(true);
      setBootDone(true);
    }
  }, []);

  // Reveals must wait for the boot fade — otherwise they play unseen behind it.
  useReveal(bootDone);

  // The terminal's `reboot` command replays this boot sequence: clear the
  // seen flag and remount the GRUB prompt.
  useEffect(() => {
    const onReboot = () => {
      try {
        window.sessionStorage.removeItem("ds-boot-seen");
      } catch {
        // ignore storage failures
      }
      setBootClosing(false);
      setBootDone(false);
    };
    window.addEventListener("site-reboot", onReboot);
    return () => window.removeEventListener("site-reboot", onReboot);
  }, []);
  return (
    <main id="main-content" tabIndex={-1} className="relative min-h-screen outline-none">
      <BackgroundFX />
      <Cursor />
      <AnalyticsBeacon />
      <WindowScrim />
      <Suspense fallback={null}>
        <CommandPalette />
      </Suspense>
      <Terminal />
      {!bootDone && <IntroBoot onCloseStart={handleBootCloseStart} onDone={handleBootDone} />}
      {bootDone && <Nav />}
      <SocialPanel />
      <RightPanel />
      <Hero booted={bootClosing} />
      <About />
      <Skills />
      <Projects />
      <Experience />
      <Certifications />
      <Achievements />
      <Building />
      <Research />
      <Blogs />
      <Testimonials />
      <Contact />
      <Footer />
      <Toaster richColors position="bottom-right" />
    </main>
  );
}
