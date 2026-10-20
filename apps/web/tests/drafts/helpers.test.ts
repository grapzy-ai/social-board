import { describe, it, expect } from "vitest";
import { bodyFromForm, canTransition } from "@/lib/drafts/status";

const fd = (o: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(o)) f.set(k, v);
  return f;
};

describe("bodyFromForm", () => {
  it("reel: splits hooks by newline and keeps script/cover", () => {
    expect(bodyFromForm("reel", fd({ script: "[0–2] хук", hooks: "раз\nдва\n\nтри ", cover: "обложка", angle: "mistake" }))).toEqual({ script: "[0–2] хук", hooks: ["раз", "два", "три"], cover: "обложка", angle: "mistake" });
  });
  it("carousel: splits slides by --- lines", () => {
    expect(bodyFromForm("carousel", fd({ slides: "слайд 1\n---\nслайд 2\n---\nслайд 3", caption: "подпись" }))).toEqual({ slides: ["слайд 1", "слайд 2", "слайд 3"], caption: "подпись" });
  });
  it("threads/story/tg: plain text", () => {
    expect(bodyFromForm("tg", fd({ text: "Заголовок\n\nтекст" }))).toEqual({ text: "Заголовок\n\nтекст" });
  });
});

describe("canTransition", () => {
  it("allows the editorial path and refuses shortcuts", () => {
    const ok: [string, string][] = [["idea", "draft"], ["draft", "ready"], ["ready", "approved"], ["ready", "rejected"], ["ready", "draft"], ["approved", "draft"], ["rejected", "draft"]];
    for (const [a, b] of ok) expect(canTransition(a as never, b as never), `${a}→${b}`).toBe(true);
    const no: [string, string][] = [["draft", "approved"], ["draft", "published"], ["published", "draft"], ["published", "approved"], ["approved", "ready"], ["approved", "published"], ["idea", "ready"]];
    for (const [a, b] of no) expect(canTransition(a as never, b as never), `${a}→${b}`).toBe(false);
  });
});
