/** Speech-to-text for bot voice notes. Optional: without OPENAI_API_KEY every call returns null and the item waits. */
export type Transcriber = (buf: Buffer, filename: string) => Promise<string | null>;

export const DEFAULT_TRANSCRIBE_MODEL = "gpt-4o-mini-transcribe";

export function makeTranscriber(f: typeof fetch = fetch): Transcriber {
  return async (buf, filename) => {
    const key = process.env.OPENAI_API_KEY;
    if (!key) return null;
    try {
      const fd = new FormData();
      fd.set("file", new File([new Uint8Array(buf)], filename, { type: "audio/ogg" }));
      fd.set("model", process.env.TRANSCRIBE_MODEL ?? DEFAULT_TRANSCRIBE_MODEL);
      fd.set("language", "ru");
      const res = await f("https://api.openai.com/v1/audio/transcriptions", { method: "POST", headers: { Authorization: `Bearer ${key}` }, body: fd });
      if (!res.ok) return null;
      const json = (await res.json()) as { text?: string };
      const text = (json.text ?? "").trim();
      return text || null;
    } catch {
      return null;
    }
  };
}

export const transcribeOpenAI: Transcriber = (buf, filename) => makeTranscriber()(buf, filename);
