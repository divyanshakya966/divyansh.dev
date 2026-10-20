import { describe, expect, it } from "vitest";
import { shapeFromElement } from "@/lib/cursor";

function build(html: string, selector: string): HTMLElement {
  document.body.innerHTML = html;
  const el = document.querySelector(selector);
  if (!el) throw new Error(`missing ${selector}`);
  return el as HTMLElement;
}

describe("shapeFromElement", () => {
  it("returns null when no data-cursor ancestor exists", () => {
    const el = build(`<div id="plain"></div>`, "#plain");
    expect(shapeFromElement(el)).toBeNull();
  });

  it("maps resize handles to arrow shapes", () => {
    const el = build(`<span data-cursor="ns-resize" id="r"></span>`, "#r");
    expect(shapeFromElement(el)).toBe("ns");
  });

  it("maps both corners to diagonal arrows", () => {
    expect(shapeFromElement(build(`<i data-cursor="nwse-resize" id="a"></i>`, "#a"))).toBe("nwse");
    expect(shapeFromElement(build(`<i data-cursor="nesw-resize" id="b"></i>`, "#b"))).toBe("nesw");
  });

  it("maps grab/grabbing to the grabbing hand", () => {
    expect(shapeFromElement(build(`<div data-cursor="grab" id="g"></div>`, "#g"))).toBe("grabbing");
  });

  it("suppresses a title-bar grab when hovering its buttons", () => {
    const btn = build(`<div data-cursor="grab"><button id="close">x</button></div>`, "#close");
    expect(shapeFromElement(btn)).toBeNull();
  });

  it("still resolves the shape when the pointer is on the bar itself", () => {
    const bar = build(`<div data-cursor="grab" id="bar"><button>x</button></div>`, "#bar");
    expect(shapeFromElement(bar)).toBe("grabbing");
  });
});
