"use client";

import { useFormStatus } from "react-dom";
import { syncSegmentAction } from "@/app/(dashboard)/settings/accounts/actions";

function Inner() {
  const { pending } = useFormStatus();
  return (
    <button disabled={pending} className="rounded-lg border border-line px-3 py-1.5 text-xs text-muted hover:text-fg disabled:opacity-60" title="Синхронизировать аккаунты сегмента (Threads, Instagram). Telegram обновляет воркер каждые 6 часов.">
      {pending ? "Обновляю…" : "Обновить"}
    </button>
  );
}

export function RefreshButton({ back }: { back: string }) {
  return (
    <form action={syncSegmentAction}>
      <input type="hidden" name="back" value={back} />
      <Inner />
    </form>
  );
}
