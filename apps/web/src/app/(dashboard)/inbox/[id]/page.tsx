import Link from "next/link";
import { notFound } from "next/navigation";
import { getDb } from "@/lib/db/client";
import { getInboxItem } from "@/lib/queries/inbox";
import { KIND_LABEL } from "@/lib/ui/factory-labels";
import { PageHeader } from "@/components/shell/PageHeader";
import { TagChips } from "@/components/ui/TagChips";
import { archiveItemAction, reopenItemAction, resortItemAction } from "../actions";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const fmt = new Intl.DateTimeFormat("ru-RU", { timeZone: "Europe/Chisinau", dateStyle: "medium", timeStyle: "short" });

export default async function InboxItemPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const item = await getInboxItem(getDb(), id);
  if (!item) notFound();
  const main = item.transcript ?? item.text;
  return (
    <div className="max-w-3xl">
      <PageHeader title={item.tags?.summary || KIND_LABEL[item.kind]} subtitle={`${KIND_LABEL[item.kind]} · ${fmt.format(item.createdAt)} · ${item.source === "bot" ? "из бота" : item.source === "manual" ? "добавлено вручную" : "Drive"}`} />
      <div className="mb-4">
        <TagChips tags={item.tags} language={item.language} />
      </div>

      {item.kind === "photo" && item.tgFileId && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={`/api/telegram/file/${encodeURIComponent(item.tgFileId)}`} alt="" className="mb-4 max-h-[480px] rounded-xl" />
      )}

      <section className="card mb-4 p-4">
        <h2 className="mb-2 text-xs uppercase tracking-wide text-muted">{item.transcript ? "Расшифровка" : "Текст"}</h2>
        {main ? <p className="whitespace-pre-wrap text-sm leading-relaxed">{main}</p> : <p className="text-sm text-muted">{item.kind === "voice" ? "Голосовое ждёт расшифровки — нужен ключ распознавания речи в настройках сервера." : "Без текста."}</p>}
        {item.mediaRef && (
          <p className="mt-3 text-sm">
            <a href={item.mediaRef} target="_blank" rel="noreferrer" className="text-accent underline">
              {item.mediaRef}
            </a>
          </p>
        )}
      </section>

      {item.tags?.hooks?.length ? (
        <section className="card mb-4 p-4">
          <h2 className="mb-2 text-xs uppercase tracking-wide text-muted">Хуки-кандидаты</h2>
          <ol className="list-decimal space-y-1 pl-5 text-sm">
            {item.tags.hooks.map((h, i) => (
              <li key={i}>{h}</li>
            ))}
          </ol>
        </section>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {item.status !== "archived" && (
          <Link href={`/drafts/new?inbox=${item.id}`} className="rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-accent-fg">
            Сгенерировать пакет
          </Link>
        )}
        {main && (
          <form action={resortItemAction}>
            <input type="hidden" name="id" value={item.id} />
            <button className="rounded-lg border border-line px-3 py-1.5 text-xs hover:text-fg">Пересортировать</button>
          </form>
        )}
        {item.status === "archived" ? (
          <form action={reopenItemAction}>
            <input type="hidden" name="id" value={item.id} />
            <button className="rounded-lg border border-line px-3 py-1.5 text-xs text-muted hover:text-fg">Вернуть из архива</button>
          </form>
        ) : (
          <form action={archiveItemAction}>
            <input type="hidden" name="id" value={item.id} />
            <button className="rounded-lg border border-line px-3 py-1.5 text-xs text-muted hover:text-fg">В архив</button>
          </form>
        )}
        <Link href="/inbox" className="rounded-lg px-3 py-1.5 text-xs text-muted hover:text-fg">
          ← Входящие
        </Link>
      </div>
    </div>
  );
}
