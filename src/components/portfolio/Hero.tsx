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
    let holdT: ReturnType<typeof setTimeout> | undefined;

    const t = setTimeout(() => {
      if (!del) {
        const next = current.slice(0, text.length + 1);
        setText(next);
        if (next === current) {
          holdT = setTimeout(() => setDel(true), 1400);
        }
      } else {
        const next = current.slice(0, text.length - 1);
        setText(next);
        if (next === "") {
          setDel(false);
          setI((v) => (v + 1) % ROLES.length);
        }
      }
    }, speed);

    return () => {
      clearTimeout(t);
      if (holdT) clearTimeout(holdT);
    };
  }, [text, del, i, enabled]);

  return text;
}

function CharSplit({
  text,
  delayBase = 0,
  play = true,
  className = "",
}: {
  text: string;
  delayBase?: number;
  play?: boolean;
  className?: string;
}) {
  return (
    <span
      className={
        play
          ? `char-rise inline-flex items-center gap-[0.08em] sm:gap-[0.1em] md:gap-[0.06em] whitespace-nowrap ${className}`
          : `inline-flex items-center gap-[0.08em] sm:gap-[0.1em] md:gap-[0.06em] whitespace-nowrap ${className}`
      }
    >
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
      className="relative min-h-viewport flex flex-col items-center pt-24 sm:pt-32 md:pt-40 pb-16 sm:pb-12 overflow-hidden"
    >
      <div className="flex-1 w-full flex items-center justify-center">
        <div
          className="relative w-full max-w-5xl px-4 sm:px-6 text-center will-change-transform transition-opacity duration-700"
          style={{
            opacity: heroOpacity,
            transform: `translateY(${-parallaxY}px) scale(${heroScale})`,
          }}
        >
          <div
            className={`flex justify-center mb-5 sm:mb-8 ${booted ? "animate-fade-in" : "boot-gated"}`}
          >
            <div className="relative w-24 h-24 sm:w-40 sm:h-40 rounded-full overflow-hidden border-2 border-gradient-to-br from-cyan to-violet p-0.5 shadow-lg shadow-cyan/20">
              <div className="absolute inset-0 rounded-full bg-gradient-to-br from-cyan/10 to-violet/10 -z-10" />
              <img
                src="/avatar.png"
                alt="Portrait of Divyansh Shakya"
                width={160}
                height={160}
                className="w-full h-full object-cover rounded-full"
              />
            </div>
          </div>

          <div
            className={`font-mono text-[9px] sm:text-xs uppercase tracking-[0.28em] sm:tracking-[0.5em] text-muted-foreground mb-5 sm:mb-8 ${booted ? "animate-fade-in" : "boot-gated"}`}
          >
            [ Aspiring Security Engineer ]
          </div>

          <h1
            className={`font-bold tracking-normal leading-[0.95] text-[clamp(2.4rem,14vw,8rem)] sm:text-[12vw] md:text-[10vw] lg:text-[8rem] glitch glitch-hoverable ${
              isGlitching ? "glitch-triggered" : ""
            }`}
            data-text="Hey There!"
          >
            <CharSplit text="Hey There!" play={booted} />
          </h1>
          <div className={booted ? "animate-fade-in" : "boot-gated"}>
            <p
              className={`font-bold tracking-normal leading-[0.95] text-[clamp(2.4rem,14vw,8rem)] sm:text-[12vw] md:text-[10vw] lg:text-[8rem] text-muted-foreground mt-4 sm:mt-6 glitch glitch-mobile glitch-hoverable ${
                isGlitching ? "glitch-triggered" : ""
              }`}
              data-text="I'm Divyansh"
            >
              <span className="flex flex-col items-center text-center sm:hidden">
                <CharSplit text="I'm" delayBase={400} play={booted} className="whitespace-nowrap" />
                <CharSplit
                  text="Divyansh"
                  delayBase={560}
                  play={booted}
                  className="whitespace-nowrap"
                />
              </span>
              <span className="hidden sm:inline-flex">
                <CharSplit text="I'm Divyansh" delayBase={400} play={booted} />
              </span>
            </p>
          </div>

          <div
            className={`mt-10 font-mono text-sm sm:text-base text-muted-foreground ${booted ? "animate-fade-in [animation-delay:1100ms]" : "boot-gated"}`}
          >
            <span className="text-foreground">~/</span>
            <span>{typed}</span>
            <span className="inline-block w-[8px] h-4 bg-foreground align-middle ml-1 animate-blink" />
          </div>
        </div>
      </div>

      <div className="relative w-full mt-10 md:mt-8 px-4 md:px-12">
        <div className="mx-auto max-w-6xl flex flex-col sm:flex-row items-center sm:items-end justify-between gap-4 sm:gap-6">
          <div
            className={`font-mono text-[11px] sm:text-xs text-muted-foreground max-w-xs text-center sm:text-left ${booted ? "animate-fade-in [animation-delay:1300ms]" : "boot-gated"}`}
          >
            Building secure, scalable systems
            <br />— DevSecOps · Linux · Cloud.
          </div>

          <a
            href="#projects"
            className={`group inline-flex items-center gap-3 font-mono text-xs uppercase tracking-[0.3em] text-foreground ${booted ? "animate-fade-in [animation-delay:1400ms]" : "boot-gated"}`}
          >
            <span className="h-px w-12 bg-foreground/40 group-hover:w-20 transition-all duration-500" />
            View Work
            <ArrowUpRight
              size={14}
              className="transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
            />
          </a>

          <div
            className={`font-mono text-[11px] sm:text-xs text-muted-foreground text-center sm:text-right ${booted ? "animate-fade-in [animation-delay:1500ms]" : "boot-gated"}`}
          >
            Bhopal, India · Open to
            <br />
            internships & hackathons
          </div>
        </div>

        <div className="mt-5 sm:mt-8 flex justify-center">
          <ArrowDown size={16} className="text-muted-foreground animate-float" />
        </div>
      </div>
    </section>
  );
}
