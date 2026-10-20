import Anthropic from "@anthropic-ai/sdk";

/** The slice of the Anthropic client our generators use; tests pass a fake with the same shape. */
export type ClientLike = {
  messages: { create: (req: Anthropic.MessageCreateParamsNonStreaming) => Promise<{ content: Array<{ type: string; text?: string }> }> };
};

let _client: Anthropic | null = null;
export function anthropicClient(): ClientLike {
  if (!_client) _client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return _client as unknown as ClientLike;
}

export function claudeModel(): string {
  return process.env.CLAUDE_MODEL ?? "claude-sonnet-4-5";
}

/** Extracts the first text block and strips a ```json fence if the model wrapped its answer. */
export function textOf(res: { content: Array<{ type: string; text?: string }> }): string {
  const raw = res.content.find((c) => c.type === "text")?.text?.trim() ?? "";
  const fenced = raw.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return (fenced ? fenced[1] : raw).trim();
}
