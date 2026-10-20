import Link from "next/link";
import { notFound } from "next/navigation";
import { getDb } from "@/lib/db/client";
import { getDraft } from "@/lib/queries/drafts";
import { nextStatuses } from "@/lib/drafts/status";
import { DRAFT_TYPE_LABEL } from "@/lib/ui/factory-labels";
import { PageHeader } from "@/components/shell/PageHeader";
import { StatusChip } from "@/components/ui/StatusChip";
import { DraftEditor } from "@/components/drafts/DraftEditor";
import { setDraftStatusAction } from "../actions";
import { PublishTelegramButton } from "./PublishTelegramButton";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const ACTION_LABEL: Record<string, string> = {
  draft: "Вернуть в черновики",
  ready: "На согласование",
  approved: "Согласовать",
  rejected: "Отклонить",
};

export default async function DraftPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const draft = await getDraft(getDb(), id);
  if (!draft) notFound();
  const locked = draft.status === "published";
  const next = nextStatuses(draft.status).filter((s) => ACTION_LABEL[s]);
  return (
    <div className="max-w-3xl">
      <PageHeader
        title={draft.title}
        subtitle={
          <span className="inline-flex items-center gap-2">
            {DRAFT_TYPE_LABEL[draft.type]} <StatusChip status={draft.status} />
            {draft.inboxItemId && (
              <Link href={`/inbox/${draft.inboxItemId}`} className="underline">
                исходник
              </Link>
            )}
          </span>
        }
      />
      {draft.publishError && <p className="mb-4 rounded-lg border border-bad px-3 py-2 text-sm text-bad">Публикация не удалась: {draft.publishError}</p>}
      {draft.publishedUrl && (
        <p className="mb-4 text-sm">
          Опубликовано:{" "}
          <a href={draft.publishedUrl} target="_blank" rel="noreferrer" className="text-accent underline">
            {draft.publishedUrl}
          </a>
        </p>
      )}
      <div className="card p-5">
        <DraftEditor draft={draft} readOnly={locked} />
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        {next.map((s) => (
          <form key={s} action={setDraftStatusAction}>
            <input type="hidden" name="id" value={draft.id} />
            <input type="hidden" name="status" value={s} />
            <button className={`rounded-lg px-3 py-1.5 text-xs ${s === "approved" || s === "ready" ? "bg-accent font-medium text-accent-fg" : "border border-line hover:text-fg"}`}>{ACTION_LABEL[s]}</button>
          </form>
        ))}
        {draft.type === "tg" && draft.status === "approved" && <PublishTelegramButton draftId={draft.id} />}
        <Link href="/drafts" className="ml-auto rounded-lg px-3 py-1.5 text-xs text-muted hover:text-fg">
          ← Черновики
        </Link>
      </div>
    </div>
  );
}
