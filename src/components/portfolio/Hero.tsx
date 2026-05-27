import { useEffect, useState } from "react";
import { ArrowDown, ArrowUpRight } from "lucide-react";

const ROLES = [
  "Cybersecurity Trainee",
  "DevSecOps Practitioner",
  "AI & Cloud Security",
  "Linux & Open Source",
];

function useTyping(enabled: boolean) {
  const [i, setI] = useState(0);
  const [text, setText] = useState("");
  const [del, setDel] = useState(false);

  useEffect(() => {
    if (!enabled) return;

    const current = ROLES[i];
    const speed = del ? 35 : 65;
    const t = setTimeout(() => {
      if (!del) {
        const next = current.slice(0, text.length + 1);
        setText(next);
        if (next === current) setTimeout(() => setDel(true), 1400);
      } else {
        const next = current.slice(0, text.length - 1);
        setText(next);
        if (next === "") {
          setDel(false);
          setI((v) => (v + 1) % ROLES.length);
        }
      }
    }, speed);
    return () => clearTimeout(t);
  }, [text, del, i, enabled]);

  return text;
}

function CharSplit({ text, delayBase = 0, play = true }: { text: string; delayBase?: number; play?: boolean }) {
  return (
    <span className={play ? "char-rise inline-flex items-center gap-[0.08em] sm:gap-[0.1em] md:gap-[0.06em] whitespace-nowrap" : "inline-flex items-center gap-[0.08em] sm:gap-[0.1em] md:gap-[0.06em] whitespace-nowrap"}>
      {text.split("").map((c, i) => (
        <span key={i} style={{ animationDelay: `${delayBase + i * 40}ms` }}>
          {c === " " ? "\u00A0" : c}
        </span>
      ))}
    </span>
  );
}

export function Hero({ booted }: { booted: boolean }) {
  const typed = useTyping(booted);
  const [scrollY, setScrollY] = useState(0);
  const [isGlitching, setIsGlitching] = useState(false);

  useEffect(() => {
    if (!booted) return;

    let timeoutId: ReturnType<typeof setTimeout>;

    const runGlitchCycle = () => {
      // Wait a random interval between 3 to 7 seconds before triggering a burst
      const nextDelay = 3000 + Math.random() * 4000;
      
      timeoutId = setTimeout(() => {
        setIsGlitching(true);
        
        // Keep the glitch burst active for 750ms
        timeoutId = setTimeout(() => {
          setIsGlitching(false);
          runGlitchCycle();
        }, 750);
        
      }, nextDelay);
    };

    // Start first periodic glitch 2.2 seconds after boot completes
    const initTimeout = setTimeout(() => {
      runGlitchCycle();
    }, 2200);

    return () => {
      clearTimeout(initTimeout);
      clearTimeout(timeoutId);
    };
  }, [booted]);

  useEffect(() => {
    const onScroll = () => setScrollY(window.scrollY);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const heroOpacity = Math.max(0, 1 - scrollY / 600);
  const heroScale = 1 + scrollY / 4000;
  const parallaxY = scrollY * 0.25;

  return (
    <section
      id="top"
      className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden"
    >
      {/* Scroll hint top */}
      <div className="absolute top-24 left-1/2 -translate-x-1/2 font-mono text-[10px] uppercase tracking-[0.4em] text-muted-foreground animate-pulse-slow">
        Scroll
      </div>

      {/* Status pill */}
      <div className="absolute top-32 right-6 sm:right-12 font-mono text-xs">
        <div className="flex items-center gap-2 text-muted-foreground">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full rounded-full bg-foreground opacity-60 animate-ping" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-foreground" />
          </span>
          <span>Learning & Training</span>
        </div>
      </div>

      {/* Centerpiece */}
      <div
        className={`relative px-4 sm:px-6 text-center will-change-transform transition-opacity duration-700 ${
          booted ? "opacity-100" : "opacity-0"
        }`}
        style={{
          opacity: heroOpacity,
          transform: `translateY(${-parallaxY}px) scale(${heroScale})`,
        }}
      >
        <div className={`font-mono text-[10px] sm:text-xs uppercase tracking-[0.5em] text-muted-foreground mb-8 ${booted ? "animate-fade-in" : "opacity-0"}`}>
          [ Aspiring Security Engineer ]
        </div>

        <h1
          className={`font-bold tracking-normal leading-[1] text-[14vw] sm:text-[12vw] md:text-[10vw] lg:text-[8rem] glitch glitch-hoverable ${
            isGlitching ? "glitch-triggered" : ""
          }`}
          data-text="Hey There!"
        >
          <CharSplit text="Hey There!" play={booted} />
        </h1>
        <div className={booted ? "animate-fade-in" : "opacity-0"}>
          <h1
            className={`font-bold tracking-normal leading-[1] text-[14vw] sm:text-[12vw] md:text-[10vw] lg:text-[8rem] text-muted-foreground mt-6 glitch glitch-hoverable ${
              isGlitching ? "glitch-triggered" : ""
            }`}
            data-text="I'm Divyansh"
          >
            <CharSplit text="I'm Divyansh" delayBase={400} play={booted} />
          </h1>
        </div>

        <div className={`mt-10 font-mono text-sm sm:text-base text-muted-foreground ${booted ? "animate-fade-in [animation-delay:1100ms]" : "opacity-0"}`}>
          <span className="text-foreground">~/</span>
          <span>{typed}</span>
          <span className="inline-block w-[8px] h-4 bg-foreground align-middle ml-1 animate-blink" />
        </div>
      </div>

      {/* Bottom row */}
      <div className="absolute bottom-12 inset-x-0 px-6 sm:px-12">
        <div className="mx-auto max-w-6xl flex flex-col sm:flex-row items-center sm:items-end justify-between gap-6">
          <div className={`font-mono text-xs text-muted-foreground max-w-xs text-center sm:text-left ${booted ? "animate-fade-in [animation-delay:1300ms]" : "opacity-0"}`}>
            Building secure, scalable systems
            <br />
            — DevSecOps · Linux · Cloud.
          </div>

          <a
            href="#projects"
            className={`group inline-flex items-center gap-3 font-mono text-xs uppercase tracking-[0.3em] text-foreground ${booted ? "animate-fade-in [animation-delay:1400ms]" : "opacity-0"}`}
          >
            <span className="h-px w-12 bg-foreground/40 group-hover:w-20 transition-all duration-500" />
            View Work
            <ArrowUpRight size={14} className="transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
          </a>

          <div className={`font-mono text-xs text-muted-foreground text-center sm:text-right ${booted ? "animate-fade-in [animation-delay:1500ms]" : "opacity-0"}`}>
            Bhopal, India · Open to
            <br />
            internships & hackathons
          </div>
        </div>

        <div className="mt-8 flex justify-center">
          <ArrowDown size={16} className="text-muted-foreground animate-float" />
        </div>
      </div>
    </section>
  );
}
