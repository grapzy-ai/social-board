import { describe, it, expect, vi } from "vitest";
import { buildPackagePrompt, generatePackage } from "@/lib/claude/package";
import { fixturePackage } from "../fixtures/package";
import { VADIM_CONTENT_SYSTEM } from "@/lib/claude/voice";

function fakeClient(reply: string | Error) {
  const create = vi.fn(async () => {
    if (reply instanceof Error) throw reply;
    return { content: [{ type: "text", text: reply }] };
  });
  return { client: { messages: { create } } as unknown as Parameters<typeof generatePackage>[1], create };
}

const input = { sourceText: "Исследование: 523 размещения, 3,1 ₽ на рубль, 8 из 8 окупились", language: "ru" as const, pillar: "influence" as const };

describe("generatePackage", () => {
  it("returns ok with a parsed package for a valid answer", async () => {
    const out = await generatePackage(input, fakeClient(JSON.stringify(fixturePackage)).client);
    expect(out.ok).toBe(true);
    if (out.ok) {
      expect(out.pkg.reels).toHaveLength(4);
      expect(out.pkg.carousel.slides).toHaveLength(10);
      expect(out.pkg.tg.title).toBe("Мы посчитали");
    }
  });

  it("rejects a package with 3 reels and reports the error without creating anything", async () => {
    const bad = { ...fixturePackage, reels: fixturePackage.reels.slice(0, 3) };
    const out = await generatePackage(input, fakeClient(JSON.stringify(bad)).client);
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.error).toMatch(/reels/);
  });

  it("prompt carries the source text, the CTA policy, the [?] rule and the variety rule", () => {
    const p = buildPackagePrompt(input);
    expect(p).toContain(input.sourceText);
    expect(p).toContain("ИССЛЕДОВАНИЕ");
    expect(p).toContain("[?]");
    expect(p).toMatch(/разных механик/);
    expect(VADIM_CONTENT_SYSTEM).toContain("Давайте разберёмся");
    expect(VADIM_CONTENT_SYSTEM.toLowerCase()).toContain("хештег");
  });

  it("returns ok:false (not throw) when the client throws or answers prose", async () => {
    expect((await generatePackage(input, fakeClient(new Error("boom")).client)).ok).toBe(false);
    expect((await generatePackage(input, fakeClient("Вот ваш пакет: …").client)).ok).toBe(false);
  });
});
