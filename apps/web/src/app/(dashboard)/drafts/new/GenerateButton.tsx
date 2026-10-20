"use client";

import { useFormStatus } from "react-dom";

/** Disables itself while the 1–2 minute generation runs, so a second click cannot start a second package. */
export function GenerateButton() {
  const { pending } = useFormStatus();
  return (
    <button disabled={pending} className="rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-accent-fg disabled:opacity-60">
      {pending ? "Генерирую… 1–2 минуты" : "Сгенерировать пакет"}
    </button>
  );
}
