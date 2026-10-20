import { describe, it, expect, vi } from "vitest";
import { buildSorterPrompt, NEUTRAL_TAGS, sortInboxItem } from "@/lib/claude/sorter";

function fakeClient(reply: string | Error) {
  const create = vi.fn(async () => {
    if (reply instanceof Error) throw reply;
    return { content: [{ type: "text", text: reply }] };
  });
  return { client: { messages: { create } } as unknown as Parameters<typeof sortInboxItem>[1], create };
}

const input = { text: "Еду в Сочи знакомиться с руководителем продаж, два дня в горах", kind: "voice" as const };

describe("sortInboxItem", () => {
  it("parses a valid JSON answer into tags", async () => {
    const { client } = fakeClient('{"pillar":"build","format":"reel","kind":"idea","language":"ru","summary":"Еду к команде в Сочи","hooks":["a","b"]}');
    expect(await sortInboxItem(input, client)).toEqual({ pillar: "build", format: "reel", kind: "idea", language: "ru", summary: "Еду к команде в Сочи", hooks: ["a", "b"] });
  });

  it("strips a ```json fence, truncates summary to 140 and hooks to 3", async () => {
    const long = "д".repeat(200);
    const { client } = fakeClient("```json\n" + JSON.stringify({ pillar: "life", format: "story", kind: "raw", language: "ru", summary: long, hooks: ["1", "2", "3", "4"] }) + "\n```");
    const out = await sortInboxItem(input, client);
    expect(out.summary.length).toBe(140);
    expect(out.hooks).toHaveLength(3);
    expect(out.pillar).toBe("life");
  });

  it("falls back to neutral tags on malformed JSON or client error", async () => {
    const bad = await sortInboxItem(input, fakeClient("не JSON").client);
    expect(bad).toEqual(NEUTRAL_TAGS(input.text));
    const err = await sortInboxItem(input, fakeClient(new Error("boom")).client);
    expect(err.pillar).toBeNull();
    expect(err.summary).toBe(input.text.slice(0, 140));
  });

  it("prompt names the four pillars, the six targets and demands JSON only", () => {
    const p = buildSorterPrompt(input);
    for (const s of ["influence", "build", "life", "market", "reel", "threads", "carousel", "story", "tg", "tiktok_life", "JSON"]) expect(p).toContain(s);
    expect(p).toContain(input.text);
  });
});
