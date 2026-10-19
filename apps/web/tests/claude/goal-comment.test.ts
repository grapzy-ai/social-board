import { describe, it, expect, vi } from "vitest";
import { generateGoalComment, type GoalCommentInput } from "@/lib/claude/goal-comment";

const input: GoalCommentInput = { platform: "threads", handle: "vadim.bordian", followers: 130, target: 500, daysLeft: 12, deltaYesterday: 4, avgDaily7: 3.2 };

function fakeClient(reply: string | Error) {
  const create = vi.fn(async (req: unknown) => {
    if (reply instanceof Error) throw reply;
    return { content: [{ type: "text", text: reply }] };
  });
  return { client: { messages: { create } } as unknown as Parameters<typeof generateGoalComment>[1], create };
}

describe("generateGoalComment", () => {
  it("sends every number from the input to the model and returns its trimmed text", async () => {
    const { client, create } = fakeClient("  🎯 +4 вчера, канал жив. Но до 500 нужно 31 в день, тут нужен выстрел.  ");
    const out = await generateGoalComment(input, client);
    expect(out).toBe("🎯 +4 вчера, канал жив. Но до 500 нужно 31 в день, тут нужен выстрел.");
    const req = create.mock.calls[0][0] as { system: string; messages: { content: string }[] };
    const prompt = req.messages[0].content;
    for (const n of ["130", "500", "12", "4", "3.2", "31"]) expect(prompt).toContain(n);
    expect(req.system).toMatch(/голос/i);
  });

  it("caps the comment at 240 characters", async () => {
    const { client } = fakeClient("x".repeat(400));
    const out = await generateGoalComment(input, client);
    expect(out!.length).toBeLessThanOrEqual(240);
  });

  it("returns null when the API fails instead of throwing", async () => {
    const { client } = fakeClient(new Error("rate limited"));
    expect(await generateGoalComment(input, client)).toBeNull();
  });
});
