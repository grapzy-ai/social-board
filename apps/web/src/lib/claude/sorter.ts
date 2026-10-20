import { z } from "zod";
import { PILLAR_KEYS, TARGET_KEYS, type InboxKind, type SortTags } from "@/lib/db/schema";
import { anthropicClient, claudeModel, textOf, type ClientLike } from "./client";

export type Sorter = (input: { text: string; kind: InboxKind }) => Promise<SortTags>;

const SUMMARY_MAX = 140;
const HOOK_MAX = 90;

export const SortTagsSchema = z.object({
  pillar: z.enum(PILLAR_KEYS).nullable(),
  format: z.enum(TARGET_KEYS).nullable(),
  kind: z.enum(["raw", "idea", "reference", "trend"]),
  language: z.enum(["ru", "en"]),
  summary: z.string().transform((s) => s.trim().slice(0, SUMMARY_MAX)),
  hooks: z
    .array(z.string())
    .default([])
    .transform((h) => h.map((x) => x.trim().slice(0, HOOK_MAX)).filter(Boolean).slice(0, 3)),
});

export function NEUTRAL_TAGS(text: string): SortTags {
  return { pillar: null, format: null, kind: "idea", language: "ru", summary: text.trim().slice(0, SUMMARY_MAX), hooks: [] };
}

export function buildSorterPrompt(input: { text: string; kind: InboxKind }): string {
  return [
    `Вход из контент-завода Вадима Бордияна (тип: ${input.kind}). Разложи по тегам.`,
    ``,
    `Столпы (pillar):`,
    `- influence — «Инфлюенс как перформанс»: кампании, исследование WB/Ozon, прогноз продаж, ошибки брендов, возражения селлеров.`,
    `- build — «Строю»: Influencio, Grapzy, Social Board, Caram/Mersi, build in public, вайбкодинг, фандрейзинг, команда на удалёнке.`,
    `- life — «Жизнь фаундера»: релокация, Молдова, путешествия, семья, спорт — только с выводом предпринимателя.`,
    `- market — «Рынок и споры»: контрарные позиции, ньюсджек через профессиональный угол.`,
    `null — если это не контент, а служебное.`,
    ``,
    `Куда лучше всего (format): reel · threads · carousel · story · tg · tiktok_life · null.`,
    `Правило: личное без профессионального вывода → story или tiktok_life, не reel.`,
    `Вид (kind): raw — отснятое/сырьё; idea — мысль под контент; reference — чужой пример/ссылка; trend — тренд, который надо успеть.`,
    `language: ru или en по языку текста.`,
    `summary: одна строка до ${SUMMARY_MAX} символов, по-русски, без оценки.`,
    `hooks: до 3 первых строк для ролика в голосе Вадима (прямо, с цифрой или сломом ожидания), каждая до ${HOOK_MAX} символов; если материала нет — пустой массив.`,
    ``,
    `Ответь только JSON без пояснений: {"pillar":...,"format":...,"kind":...,"language":...,"summary":"...","hooks":[...]}`,
    ``,
    `Текст:`,
    input.text,
  ].join("\n");
}

/** Never throws: on any error returns neutral tags so intake keeps working. */
export async function sortInboxItem(input: { text: string; kind: InboxKind }, client: ClientLike = anthropicClient()): Promise<SortTags> {
  try {
    const res = await client.messages.create({
      model: claudeModel(),
      max_tokens: 400,
      system: "Ты сортировщик входящих для контент-завода. Отвечаешь только валидным JSON.",
      messages: [{ role: "user", content: buildSorterPrompt(input) }],
    });
    const parsed = SortTagsSchema.safeParse(JSON.parse(textOf(res)));
    return parsed.success ? parsed.data : NEUTRAL_TAGS(input.text);
  } catch {
    return NEUTRAL_TAGS(input.text);
  }
}
