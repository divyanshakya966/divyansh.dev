import { useEffect } from "react";
import { toast } from "sonner";

/** Global egg: typing "hireme" anywhere (outside inputs) nudges to contact. */
export function useHireMeEgg() {
  useEffect(() => {
    let buf = "";
    let timer: ReturnType<typeof setTimeout> | undefined;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (!/^[a-z]$/i.test(e.key)) return;
      buf = (buf + e.key.toLowerCase()).slice(-6);
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => (buf = ""), 1500);
      if (buf === "hireme") {
        buf = "";
        toast.success("Good instinct — let's talk.", {
          action: {
            label: "Contact",
            onClick: () =>
              document.getElementById("contact")?.scrollIntoView({ behavior: "smooth" }),
          },
        });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      if (timer) clearTimeout(timer);
    };
  }, []);
}
