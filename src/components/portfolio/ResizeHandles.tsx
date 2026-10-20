import type { ResizeEdge } from "@/hooks/use-window-manager";

type Props = {
  onResize: (edge: ResizeEdge) => (e: React.PointerEvent) => void;
  label: string;
};

const EDGE_DATA_CURSOR: Record<ResizeEdge, string> = {
  n: "ns-resize",
  s: "ns-resize",
  e: "ew-resize",
  w: "ew-resize",
  ne: "nesw-resize",
  nw: "nwse-resize",
  se: "nwse-resize",
  sw: "nesw-resize",
};

const EDGES: { edge: ResizeEdge; className: string }[] = [
  { edge: "n", className: "inset-x-0 top-0 h-1.5" },
  { edge: "s", className: "inset-x-0 bottom-0 h-1.5" },
  { edge: "e", className: "inset-y-0 right-0 w-1.5" },
  { edge: "w", className: "inset-y-0 left-0 w-1.5" },
  { edge: "ne", className: "top-0 right-0 h-3 w-3" },
  { edge: "nw", className: "top-0 left-0 h-3 w-3" },
  { edge: "se", className: "bottom-0 right-0 h-3 w-3" },
  { edge: "sw", className: "bottom-0 left-0 h-3 w-3" },
];

/**
 * Absolutely-positioned grab strips along each edge and corner of a window.
 * They are invisible but sit above the content so dragging an edge resizes
 * the floating shell like a desktop window.
 */
export function ResizeHandles({ onResize, label }: Props) {
  return (
    <>
      {EDGES.map(({ edge, className }) => (
        <span
          key={edge}
          role="presentation"
          aria-label={`Resize ${label} (${edge})`}
          data-cursor={EDGE_DATA_CURSOR[edge]}
          onPointerDown={onResize(edge)}
          className={`absolute z-10 ${className}`}
        />
      ))}
    </>
  );
}
