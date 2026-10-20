import Link from "next/link";
import { cookies } from "next/headers";
import { getDb } from "@/lib/db/client";
import { listInbox } from "@/lib/queries/inbox";
import { resolveSegment, segmentLanguage, SEGMENT_COOKIE } from "@/lib/ui/segment";
import { KIND_GLYPH, KIND_LABEL } from "@/lib/ui/factory-labels";
import { PageHeader } from "@/components/shell/PageHeader";
import { TagChips } from "@/components/ui/TagChips";
import { addManualItemAction, archiveItemAction } from "./actions";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const TABS = [
  { key: "open", label: "открытые" },
  { key: "used", label: "использованные" },
  { key: "archived", label: "архив" },
] as const;

const fmtTime = new Intl.DateTimeFormat("ru-RU", { timeZone: "Europe/Chisinau", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

export default async function InboxPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const tab = (TABS.find((t) => t.key === sp.status)?.key ?? "open") as (typeof TABS)[number]["key"];
  const segment = resolveSegment((await cookies()).get(SEGMENT_COOKIE)?.value);
  const language = segmentLanguage(segment) ?? undefined;
  const items = await listInbox(getDb(), { status: tab, language });

  return (
    <div>
      <PageHeader title="Входящие" subtitle="Всё, что упало в бота или добавлено здесь. Лёгкое — в бота, видео — в Drive." />

      <form action={addManualItemAction} className="card mb-6 flex flex-col gap-2 p-4">
        <label className="text-xs text-muted" htmlFor="inbox-text">
          Добавить вручную — мысль, ссылка на ролик, ссылка на папку Drive
        </label>
        <textarea id="inbox-text" name="text" required rows={2} className="w-full resize-y rounded-lg border border-line bg-surface px-3 py-2 text-sm" placeholder="Например: идея — почему каждое пятое размещение не окупается, разобрать на экране" />
        <div className="flex justify-end">
          <button className="rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-accent-fg">Добавить и разобрать</button>
        </div>
      </form>

      <nav className="mb-4 flex gap-2 text-xs">
        {TABS.map((t) => (
          <Link key={t.key} href={`/inbox?status=${t.key}`} className={`rounded-full border px-3 py-1 ${t.key === tab ? "border-fg text-fg" : "border-line text-muted hover:text-fg"}`}>
            {t.label}
          </Link>
        ))}
      </nav>

      {items.length === 0 ? (
        <p className="text-sm text-muted">Пусто. Напиши боту или добавь выше.</p>
      ) : (
        <ul className="divide-y divide-line rounded-xl border border-line">
          {items.map((it) => {
            const body = (it.tags?.summary || it.transcript || it.text || it.mediaRef || "").trim();
            return (
              <li key={it.id} className="flex items-start gap-3 px-4 py-3 text-sm">
                <span className="w-6 shrink-0 text-center" title={KIND_LABEL[it.kind]}>
                  {KIND_GLYPH[it.kind]}
                </span>
                {it.kind === "photo" && it.tgFileId && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={`/api/telegram/file/${encodeURIComponent(it.tgFileId)}`} alt="" className="h-16 w-16 shrink-0 rounded object-cover" />
                )}
                <div className="min-w-0 flex-1">
                  <Link href={`/inbox/${it.id}`} className="line-clamp-2 hover:underline">
                    {body || <span className="text-muted">без текста</span>}
                  </Link>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted">
                    <span>{fmtTime.format(it.createdAt)}</span>
                    <TagChips tags={it.tags} language={it.language} />
                    {it.kind === "voice" && !it.transcript && <span>⏳ ждёт расшифровки</span>}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {tab === "open" && (
                    <Link href={`/drafts/new?inbox=${it.id}`} className="rounded-lg border border-line px-2 py-1 text-xs hover:text-fg">
                      Пакет
                    </Link>
                  )}
                  {tab !== "archived" && (
                    <form action={archiveItemAction}>
                      <input type="hidden" name="id" value={it.id} />
                      <button className="rounded-lg border border-line px-2 py-1 text-xs text-muted hover:text-fg">В архив</button>
                    </form>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
