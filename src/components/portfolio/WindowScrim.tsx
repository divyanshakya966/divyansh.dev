import { AnimatePresence, motion } from "motion/react";
import { dismissFocusedWindow, useAnyWindowVisible } from "@/hooks/use-window-manager";

/**
 * The single site-wide scrim behind every floating shell window. It renders
 * *below* the windows (z-90 < window z-93..97), so the background stays
 * dimmed/blurred whenever any window is open while each window itself stays
 * crisp — siblings never blur one another. Clicking it dismisses the focused
 * window (click-away), mirroring the previous per-window backdrop.
 */
export function WindowScrim() {
  const anyOpen = useAnyWindowVisible();
  return (
    <AnimatePresence>
      {anyOpen && (
        <motion.div
          data-testid="window-scrim"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          className="fixed inset-0 z-[90] bg-black/60 backdrop-blur-sm pointer-events-auto"
          aria-hidden="true"
          onClick={dismissFocusedWindow}
        />
      )}
    </AnimatePresence>
  );
}
