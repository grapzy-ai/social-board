import { z } from "zod";
import { PILLAR_KEYS } from "@/lib/db/schema";
import { anthropicClient, claudeModel, textOf, type ClientLike } from "./client";
import { VADIM_CONTENT_SYSTEM } from "./voice";

export const ANGLES = ["teach", "opinion", "mistake", "story", "step"] as const;
export const HOOK_MECHANICS = ["cutoff", "break", "failstack", "confession", "number", "loss", "peek", "argue"] as const;
export const FUNNEL = ["tofu", "mofu", "bofu"] as const;

const Reel = z.object({
  title: z.string().min(1),
  hooks: z.array(z.string().min(1)).min(3).max(5),
  script: z.string().min(20),
  cover: z.string().min(1),
  angle: z.enum(ANGLES).default("teach"),
  hookMechanic: z.enum(HOOK_MECHANICS).default("number"),
  funnel: z.enum(FUNNEL).default("tofu"),
});

export const PackageSchema = z.object({
  reels: z.array(Reel).length(4),
  threads: z.array(z.string().min(1)).length(5),
  carousel: z.object({ title: z.string().min(1), slides: z.array(z.string().min(1)).length(10), caption: z.string().min(1) }),
  stories: z.array(z.string().min(1)).length(3),
  tg: z.object({ title: z.string().min(1), text: z.string().min(200) }),
});
export type GeneratedPackage = z.infer<typeof PackageSchema>;

export interface PackageInput {
  sourceText: string;
  summary?: string;
  pillar?: (typeof PILLAR_KEYS)[number] | null;
  language: "ru" | "en";
}

export function buildPackagePrompt(i: PackageInput): string {
  const lang = i.language === "en" ? "Пиши по-английски (адаптация под США: другие примеры, международные бренды из списка)." : "Пиши по-русски.";
  return [
    `Собери пакет контента из одного исходника. ${lang}`,
    i.pillar ? `Столп: ${i.pillar}.` : "",
    i.summary ? `Суть исходника: ${i.summary}` : "",
    ``,
    `Состав пакета (строго):`,
    `- reels: ровно 4 сценария Reels. Четыре разных механики хука (hookMechanic) и четыре разных ракурса (angle: teach — научить, opinion — мнение, mistake — ошибка, story — личная история по теме, step — шаг сегодня). У каждого: title; hooks — 3–5 вариантов первой строки; script с таймкодами [0–2] … и пометками ГОЛОС/ЭКРАН/ТЕКСТ, 30–45 секунд (один из четырёх — короткий текст-на-футаже 12–18 с, если исходник позволяет); cover — заголовок обложки до 6 слов; funnel — tofu/mofu/bofu.`,
    `- threads: ровно 5 постов по 1–4 строки, каждый заканчивается вопросом; без форматирования и хештегов.`,
    `- carousel: title + ровно 10 слайдов (slides — массив строк, слайд 1 обложка, 2 второй хук, 9 урок списком через «·», 10 — CTA «пиши ИССЛЕДОВАНИЕ») + caption — подпись к посту.`,
    `- stories: ровно 3 сторис, каждая — 1–2 предложения + механика в скобках (опрос / стикер-вопрос / ссылка).`,
    `- tg: title (первая строка-заголовок) + text — пост 1 500–3 000 знаков по рамке истории, заголовок внутри text первой строкой, списки через «•», в конце вопрос.`,
    ``,
    `Правила: факты и цифры только из исходника, иначе [?]. Один CTA на материал, только разрешённые: «пиши «ИССЛЕДОВАНИЕ»», «подробнее в Telegram», вопрос, анонс серии. Ничего не продавать.`,
    ``,
    `Ответь только JSON без пояснений по схеме:`,
    `{"reels":[{"title":"","hooks":["",""],"script":"","cover":"","angle":"teach|opinion|mistake|story|step","hookMechanic":"cutoff|break|failstack|confession|number|loss|peek|argue","funnel":"tofu|mofu|bofu"}],"threads":["",""],"carousel":{"title":"","slides":["",""],"caption":""},"stories":["",""],"tg":{"title":"","text":""}}`,
    ``,
    `ИСХОДНИК:`,
    i.sourceText,
  ]
    .filter((l) => l !== "")
    .join("\n");
}

export type PackageResult = { ok: true; pkg: GeneratedPackage } | { ok: false; error: string };

/** Never throws. A malformed or incomplete answer is an error, not a partial package. */
export async function generatePackage(i: PackageInput, client: ClientLike = anthropicClient()): Promise<PackageResult> {
  try {
    const res = await client.messages.create({
      model: claudeModel(),
      max_tokens: 8000,
      system: VADIM_CONTENT_SYSTEM,
      messages: [{ role: "user", content: buildPackagePrompt(i) }],
    });
    let json: unknown;
    try {
      json = JSON.parse(textOf(res));
    } catch {
      return { ok: false, error: "модель ответила не JSON — попробуй ещё раз" };
    }
    const parsed = PackageSchema.safeParse(json);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      return { ok: false, error: `пакет не по схеме: ${issue.path.join(".")} — ${issue.message}` };
    }
    return { ok: true, pkg: parsed.data };
  } catch (e) {
    return { ok: false, error: `генерация не удалась: ${(e as Error).message}` };
  }
}
