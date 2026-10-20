import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeTranscriber } from "@/lib/transcribe";

describe("transcribe (OpenAI audio)", () => {
  beforeEach(() => {
    delete process.env.OPENAI_API_KEY;
    delete process.env.TRANSCRIBE_MODEL;
  });

  it("returns null without OPENAI_API_KEY and never calls fetch", async () => {
    const f = vi.fn();
    const t = makeTranscriber(f as unknown as typeof fetch);
    expect(await t(Buffer.from("x"), "voice.oga")).toBeNull();
    expect(f).not.toHaveBeenCalled();
  });

  it("posts multipart with model + language=ru and returns trimmed text", async () => {
    process.env.OPENAI_API_KEY = "sk-test";
    const f = vi.fn(async (_url: string, init: RequestInit) => {
      const fd = init.body as FormData;
      expect(fd.get("model")).toBe("gpt-4o-mini-transcribe");
      expect(fd.get("language")).toBe("ru");
      expect((fd.get("file") as File).name).toBe("voice.oga");
      expect((init.headers as Record<string, string>).Authorization).toBe("Bearer sk-test");
      return new Response(JSON.stringify({ text: " Привет, это тест " }), { status: 200 });
    });
    const t = makeTranscriber(f as unknown as typeof fetch);
    expect(await t(Buffer.from("ogg"), "voice.oga")).toBe("Привет, это тест");
    expect(String((f.mock.calls[0] as unknown as [string])[0])).toBe("https://api.openai.com/v1/audio/transcriptions");
  });

  it("returns null on a non-2xx answer", async () => {
    process.env.OPENAI_API_KEY = "sk-test";
    const t = makeTranscriber(vi.fn(async () => new Response("nope", { status: 401 })) as unknown as typeof fetch);
    expect(await t(Buffer.from("ogg"), "a.oga")).toBeNull();
  });
});
