import { describe, it, expect, vi, beforeEach } from "vitest";
import { downloadFile, fileUrl, getFilePath } from "@/lib/telegram/files";

const json = (o: unknown) => new Response(JSON.stringify(o), { status: 200, headers: { "content-type": "application/json" } });

describe("telegram files", () => {
  beforeEach(() => {
    process.env.TG_BOT_TOKEN = "123:abc";
  });

  it("resolves getFile path and builds the download url", async () => {
    const f = vi.fn(async () => json({ ok: true, result: { file_path: "voice/1.oga", file_size: 1000 } }));
    expect(await getFilePath("F1", f as unknown as typeof fetch)).toBe("voice/1.oga");
    expect(String((f.mock.calls[0] as unknown as [string])[0])).toContain("/bot123:abc/getFile");
    expect(fileUrl("voice/1.oga")).toBe("https://api.telegram.org/file/bot123:abc/voice/1.oga");
  });

  it("downloads the bytes behind a file id", async () => {
    const f = vi.fn(async (url: string) => (url.includes("getFile") ? json({ ok: true, result: { file_path: "photos/p.jpg", file_size: 3 } }) : new Response(new Uint8Array([1, 2, 3]))));
    const out = await downloadFile("P1", f as unknown as typeof fetch);
    expect(out?.path).toBe("photos/p.jpg");
    expect(out?.buf.length).toBe(3);
  });

  it("refuses files over 20 MB without fetching them", async () => {
    const f = vi.fn(async () => json({ ok: true, result: { file_path: "video/big.mp4", file_size: 25_000_000 } }));
    expect(await downloadFile("V1", f as unknown as typeof fetch)).toBeNull();
    expect(f).toHaveBeenCalledTimes(1);
  });

  it("returns null when the token is missing or the API fails", async () => {
    delete process.env.TG_BOT_TOKEN;
    expect(await getFilePath("x", vi.fn() as unknown as typeof fetch)).toBeNull();
    process.env.TG_BOT_TOKEN = "t";
    expect(await downloadFile("x", vi.fn(async () => { throw new Error("net"); }) as unknown as typeof fetch)).toBeNull();
  });
});
