import Link from "next/link";
import { getDb } from "@/lib/db/client";
import { getInboxItem } from "@/lib/queries/inbox";
import { PageHeader } from "@/components/shell/PageHeader";
import { generatePackageAction } from "../actions";

export const dynamic = "force-dynamic";
// One package is one long Claude call; give the action the cron budget.
export const maxDuration = 300;

export default async function NewDraftPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const item = sp.inbox && /^[0-9a-f-]{36}$/.test(sp.inbox) ? await getInboxItem(getDb(), sp.inbox) : null;
  const prefill = item ? [item.transcript ?? item.text ?? "", item.mediaRef ? `Ссылка/материал: ${item.mediaRef}` : ""].filter(Boolean).join("\n") : "";
  return (
    <div className="max-w-3xl">
      <PageHeader title="Новый пакет" subtitle="Один исходник → 4 Reels, 5 Threads, карусель, 3 сторис, пост в Telegram. Генерация занимает 1–2 минуты." />
      {sp.error && <p className="mb-4 rounded-lg border border-bad px-3 py-2 text-sm text-bad">Не получилось: {sp.error}</p>}
      <form action={generatePackageAction} className="card space-y-4 p-5">
        <input type="hidden" name="inboxId" value={item?.id ?? ""} />
        {item && (
          <p className="text-xs text-muted">
            Из входящего: <Link href={`/inbox/${item.id}`} className="underline">{item.tags?.summary ?? item.id.slice(0, 8)}</Link>
          </p>
        )}
        <div>
          <label className="mb-1 block text-xs text-muted" htmlFor="sourceText">Исходник — pillar-пост, расшифровка голосового, тезисы, цифры</label>
          <textarea id="sourceText" name="sourceText" rows={14} defaultValue={prefill} className="w-full resize-y rounded-lg border border-line bg-surface px-3 py-2 text-sm leading-relaxed" placeholder="Вставь текст. Чем больше фактов и цифр — тем меньше [?] в пакете." />
        </div>
        <fieldset className="flex items-center gap-4 text-sm">
          <legend className="mb-1 text-xs text-muted">Язык пакета</legend>
          <label className="flex items-center gap-1.5"><input type="radio" name="language" value="ru" defaultChecked /> RU</label>
          <label className="flex items-center gap-1.5"><input type="radio" name="language" value="en" /> EN (адаптация)</label>
        </fieldset>
        <div className="flex justify-end gap-2">
          <Link href="/drafts" className="rounded-lg px-3 py-1.5 text-xs text-muted hover:text-fg">Отмена</Link>
          <button className="rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-accent-fg">Сгенерировать пакет</button>
        </div>
      </form>
    </div>
  );
}
