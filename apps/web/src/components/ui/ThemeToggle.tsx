import { setThemeAction } from "@/app/actions/prefs";
import type { Theme } from "@/lib/ui/theme";

const OPTIONS: Array<{ value: Theme; label: string; title: string }> = [
  { value: "light", label: "☀", title: "Светлая" },
  { value: "dark", label: "☾", title: "Тёмная" },
  { value: "system", label: "авто", title: "Как в системе" },
];

export function ThemeToggle({ current }: { current: Theme }) {
  return (
    <form action={setThemeAction} className="flex rounded-lg border border-line p-0.5 text-xs">
      {OPTIONS.map((o) => (
        <button
          key={o.value}
          name="theme"
          value={o.value}
          title={o.title}
          aria-pressed={current === o.value}
          className={`rounded-md px-2 py-1 ${current === o.value ? "bg-fg text-surface" : "text-muted hover:text-fg"}`}
        >
          {o.label}
        </button>
      ))}
    </form>
  );
}
