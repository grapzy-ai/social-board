import Link from "next/link";
import { cookies } from "next/headers";
import { getDb } from "@/lib/db/client";
import { DRAFT_STATUSES, DRAFT_TYPES, type DraftStatus, type DraftType } from "@/lib/db/schema";
import { listDrafts } from "@/lib/queries/drafts";
import { bodyText } from "@/lib/drafts/status";
import { resolveSegment, segmentLanguage, SEGMENT_COOKIE } from "@/lib/ui/segment";
import { DRAFT_STATUS_LABEL, DRAFT_TYPE_LABEL } from "@/lib/ui/factory-labels";
import { PageHeader } from "@/components/shell/PageHeader";
import { StatusChip } from "@/components/ui/StatusChip";

export const dynamic = "force-dynamic";

const TYPE_GLYPH: Record<DraftType, string> = { reel: "▶", threads: "@", carousel: "▤", story: "◔", tg: "✈" };
const fmtTime = new Intl.DateTimeFormat("ru-RU", { timeZone: "Europe/Chisinau", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

export default async function DraftsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const status = (DRAFT_STATUSES as readonly string[]).includes(sp.status ?? "") ? (sp.status as DraftStatus) : undefined;
  const type = (DRAFT_TYPES as readonly string[]).includes(sp.type ?? "") ? (sp.type as DraftType) : undefined;
  const inboxItemId = sp.inbox && /^[0-9a-f-]{36}$/.test(sp.inbox) ? sp.inbox : undefined;
  const segment = resolveSegment((await cookies()).get(SEGMENT_COOKIE)?.value);
  const language = segmentLanguage(segment) ?? undefined;
  const rows = await listDrafts(getDb(), { status, type, inboxItemId, language });

  const link = (patch: Record<string, string | undefined>) => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries({ status, type, inbox: inboxItemId, ...patch })) if (v) q.set(k, v);
    const s = q.toString();
    return `/drafts${s ? `?${s}` : ""}`;
  };
  const pill = (active: boolean) => `rounded-full border px-3 py-1 ${active ? "border-fg text-fg" : "border-line text-muted hover:text-fg"}`;

  return (
    <div>
      <PageHeader
        title="Черновики"
        subtitle="Пакеты из входящих и с нуля. Статус «на согласование» уходит карточкой в бот."
        actions={
          <Link href="/drafts/new" className="rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-accent-fg">
            Новый пакет
          </Link>
        }
      />
      <nav className="mb-3 flex flex-wrap gap-2 text-xs">
        <Link href={link({ status: undefined })} className={pill(!status)}>все</Link>
        {DRAFT_STATUSES.filter((s) => s !== "idea" && s !== "scheduled").map((s) => (
          <Link key={s} href={link({ status: s })} className={pill(status === s)}>
            {DRAFT_STATUS_LABEL[s]}
          </Link>
        ))}
      </nav>
      <nav className="mb-5 flex flex-wrap gap-2 text-xs">
        <Link href={link({ type: undefined })} className={pill(!type)}>все форматы</Link>
        {DRAFT_TYPES.map((t) => (
          <Link key={t} href={link({ type: t })} className={pill(type === t)}>
            {DRAFT_TYPE_LABEL[t]}
          </Link>
        ))}
        {inboxItemId && (
          <Link href={link({ inbox: undefined })} className="rounded-full border border-accent px-3 py-1 text-accent">
            только этот пакет ×
          </Link>
        )}
      </nav>

      {rows.length === 0 ? (
        <p className="text-sm text-muted">Черновиков нет. Сгенерируй пакет из входящего или начни с нуля.</p>
      ) : (
        <ul className="divide-y divide-line rounded-xl border border-line">
          {rows.map((d) => (
            <li key={d.id} className="flex items-start gap-3 px-4 py-3 text-sm">
              <span className="w-6 shrink-0 text-center text-muted" title={DRAFT_TYPE_LABEL[d.type]}>
                {TYPE_GLYPH[d.type]}
              </span>
              <div className="min-w-0 flex-1">
                <Link href={`/drafts/${d.id}`} className="font-medium hover:underline">
                  {d.title}
                </Link>
                <p className="line-clamp-2 text-muted">{bodyText(d.body).slice(0, 160)}</p>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted">
                  <span>{DRAFT_TYPE_LABEL[d.type]}</span>
                  {d.language === "en" && <span className="rounded border border-line px-1">EN</span>}
                  <span>{fmtTime.format(d.createdAt)}</span>
                  {d.publishedUrl && (
                    <a href={d.publishedUrl} target="_blank" rel="noreferrer" className="text-accent underline">
                      опубликовано ↗
                    </a>
                  )}
                </div>
              </div>
              <StatusChip status={d.status} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
