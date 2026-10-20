import type { Draft, ReelBody } from "@/lib/db/schema";
import { saveDraftAction } from "@/app/(dashboard)/drafts/actions";

const ta = "w-full resize-y rounded-lg border border-line bg-surface px-3 py-2 font-mono text-[13px] leading-relaxed";
const label = "mb-1 block text-xs text-muted";

/** Server-rendered form; one textarea per body field. Saving keeps status untouched. */
export function DraftEditor({ draft, readOnly }: { draft: Draft; readOnly: boolean }) {
  const b = draft.body as Record<string, unknown>;
  const fields =
    draft.type === "reel" ? (
      <>
        <div>
          <label className={label}>Хуки — по одному в строке</label>
          <textarea name="hooks" rows={4} className={ta} defaultValue={((b as ReelBody).hooks ?? []).join("\n")} readOnly={readOnly} />
        </div>
        <div>
          <label className={label}>Сценарий с таймкодами</label>
          <textarea name="script" rows={16} className={ta} defaultValue={String(b.script ?? "")} readOnly={readOnly} />
        </div>
        <div className="grid gap-3 md:grid-cols-4">
          <div className="md:col-span-2">
            <label className={label}>Обложка (до 6 слов)</label>
            <input name="cover" className={`${ta} font-sans`} defaultValue={String(b.cover ?? "")} readOnly={readOnly} />
          </div>
          <div>
            <label className={label}>Ракурс</label>
            <input name="angle" className={`${ta} font-sans`} defaultValue={String(b.angle ?? "")} readOnly={readOnly} />
          </div>
          <div>
            <label className={label}>Механика хука</label>
            <input name="hookMechanic" className={`${ta} font-sans`} defaultValue={String(b.hookMechanic ?? "")} readOnly={readOnly} />
          </div>
        </div>
        <input type="hidden" name="funnel" value={String(b.funnel ?? "")} />
      </>
    ) : draft.type === "carousel" ? (
      <>
        <div>
          <label className={label}>Слайды — разделяй строкой из трёх дефисов «---»</label>
          <textarea name="slides" rows={22} className={ta} defaultValue={((b.slides as string[]) ?? []).join("\n---\n")} readOnly={readOnly} />
        </div>
        <div>
          <label className={label}>Подпись к посту</label>
          <textarea name="caption" rows={5} className={ta} defaultValue={String(b.caption ?? "")} readOnly={readOnly} />
        </div>
      </>
    ) : (
      <div>
        <label className={label}>Текст</label>
        <textarea name="text" rows={draft.type === "tg" ? 22 : 6} className={ta} defaultValue={String(b.text ?? "")} readOnly={readOnly} />
      </div>
    );

  return (
    <form action={saveDraftAction} className="space-y-4">
      <input type="hidden" name="id" value={draft.id} />
      <input type="hidden" name="type" value={draft.type} />
      <div>
        <label className={label}>Заголовок</label>
        <input name="title" className={`${ta} font-sans`} defaultValue={draft.title} readOnly={readOnly} required />
      </div>
      {fields}
      {!readOnly && (
        <div className="flex justify-end">
          <button className="rounded-lg border border-line px-3 py-1.5 text-xs hover:text-fg">Сохранить</button>
        </div>
      )}
    </form>
  );
}
