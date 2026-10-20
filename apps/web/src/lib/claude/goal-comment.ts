import { VADIM_VOICE_SYSTEM } from "./voice";
import { anthropicClient, claudeModel, type ClientLike } from "./client";

export { anthropicClient, type ClientLike };

export interface GoalCommentInput {
  platform: string;
  handle: string;
  followers: number;
  target: number;
  daysLeft: number;
  deltaYesterday: number | null;
  avgDaily7: number | null;
}

export const GOAL_COMMENT_MAX = 240;

export function buildGoalPrompt(i: GoalCommentInput): string {
  const needPerDay = i.daysLeft > 0 ? Math.max(0, Math.ceil((i.target - i.followers) / i.daysLeft)) : 0;
  return [
    `Площадка: ${i.platform} (@${i.handle}).`,
    `Подписчиков сейчас: ${i.followers}. Цель месяца: ${i.target}. Дней до конца месяца: ${i.daysLeft}.`,
    `Прирост вчера: ${i.deltaYesterday === null ? "нет данных" : i.deltaYesterday}. Средний прирост за 7 дней: ${i.avgDaily7 === null ? "нет данных" : i.avgDaily7} в день.`,
    `Чтобы дойти до цели, нужно ${needPerDay} в день.`,
    ``,
    `Напиши один комментарий к этой карточке: 1–2 предложения, до ${GOAL_COMMENT_MAX} символов, начни с одного эмодзи по настроению, затем сухой факт и вывод. Пример тона: «🎯 +17 в тихое воскресенье, канал жив. Но до 7000 нужно 80 в день, тут нужен выстрел». Без кавычек, без пояснений.`,
  ].join("\n");
}

/** 1–2 sentences in Vadim's voice; null on any failure (callers keep the previous comment). */
export async function generateGoalComment(input: GoalCommentInput, client: ClientLike = anthropicClient()): Promise<string | null> {
  try {
    const res = await client.messages.create({
      model: claudeModel(),
      max_tokens: 200,
      system: VADIM_VOICE_SYSTEM,
      messages: [{ role: "user", content: buildGoalPrompt(input) }],
    });
    const text = res.content.find((c) => c.type === "text")?.text?.trim() ?? "";
    if (!text) return null;
    return text.length > GOAL_COMMENT_MAX ? text.slice(0, GOAL_COMMENT_MAX - 1).trimEnd() + "…" : text;
  } catch {
    return null;
  }
}
