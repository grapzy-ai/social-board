import type { DraftStatus, DraftType, InboxKind, PillarKey, SortTags, TargetKey } from "@/lib/db/schema";

export const PILLAR_LABEL: Record<PillarKey, string> = {
  influence: "Инфлюенс",
  build: "Строю",
  life: "Жизнь",
  market: "Рынок",
};

export const TARGET_LABEL: Record<TargetKey, string> = {
  reel: "Reels",
  threads: "Threads",
  carousel: "Карусель",
  story: "Сторис",
  tg: "Telegram",
  tiktok_life: "TikTok life",
};

export const KIND_LABEL: Record<InboxKind, string> = {
  voice: "голосовое",
  text: "текст",
  link: "ссылка",
  photo: "фото",
  video: "видео",
  document: "файл",
  forward: "пересланное",
};

export const KIND_GLYPH: Record<InboxKind, string> = {
  voice: "🎙",
  text: "✎",
  link: "🔗",
  photo: "📷",
  video: "🎬",
  document: "📎",
  forward: "↪",
};

export const SORT_KIND_LABEL: Record<SortTags["kind"], string> = {
  raw: "сырьё",
  idea: "идея",
  reference: "референс",
  trend: "тренд",
};

export const DRAFT_TYPE_LABEL: Record<DraftType, string> = {
  reel: "Reels",
  threads: "Threads",
  carousel: "Карусель",
  story: "Сторис",
  tg: "Telegram",
};

export const DRAFT_STATUS_LABEL: Record<DraftStatus, string> = {
  idea: "идея",
  draft: "черновик",
  ready: "на согласование",
  approved: "согласовано",
  scheduled: "запланировано",
  published: "опубликовано",
  rejected: "отклонено",
};

/** One line for bot acks and list rows: «Строю · Reels · Еду к команде в Сочи». */
export function describeTags(t: SortTags): string {
  return [t.pillar ? PILLAR_LABEL[t.pillar] : null, t.format ? TARGET_LABEL[t.format] : null, t.summary].filter(Boolean).join(" · ");
}
