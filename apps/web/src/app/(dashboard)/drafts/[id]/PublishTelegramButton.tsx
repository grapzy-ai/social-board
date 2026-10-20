"use client";

import { useFormStatus } from "react-dom";
import { publishDraftAction } from "../actions";

function Inner() {
  const { pending } = useFormStatus();
  return (
    <button disabled={pending} className="rounded-lg bg-good px-3 py-1.5 text-xs font-medium text-accent-fg disabled:opacity-60">
      {pending ? "Публикую…" : "Опубликовать в Telegram"}
    </button>
  );
}

/** Visible only for approved `tg` drafts; the server action re-checks the status. */
export function PublishTelegramButton({ draftId }: { draftId: string }) {
  return (
    <form action={publishDraftAction}>
      <input type="hidden" name="id" value={draftId} />
      <Inner />
    </form>
  );
}
