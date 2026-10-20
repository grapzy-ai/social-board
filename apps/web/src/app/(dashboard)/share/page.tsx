import { cookies } from "next/headers";
import { PageHeader } from "@/components/shell/PageHeader";
import { resolvePeriod } from "@/lib/ui/period";
import { resolveTheme, THEME_COOKIE } from "@/lib/ui/theme";
import { resolveSegment, SEGMENT_COOKIE } from "@/lib/ui/segment";
import { chisinauDate } from "@/lib/time";

export const dynamic = "force-dynamic";

export default async function SharePage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const spec = resolvePeriod(sp, chisinauDate(new Date()));
  const jar = await cookies();
  const uiTheme = resolveTheme(jar.get(THEME_COOKIE)?.value);
  const segment = resolveSegment(jar.get(SEGMENT_COOKIE)?.value);
  const cardTheme = sp.card === "dark" || sp.card === "light" ? sp.card : uiTheme === "dark" ? "dark" : "light";
  const periodQs = spec.preset ? `period=${spec.preset}` : `from=${spec.from}&to=${spec.to}`;
  const img = (format: "square" | "story") => `/api/share?format=${format}&theme=${cardTheme}&seg=${segment}&${periodQs}`;
  const pageQs = (card: "light" | "dark") => `/share?${periodQs}&card=${card}`;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Поделиться"
        subtitle="Карточка с цифрами сегмента за период — для поста и для сторис. Публикуется только то, что ты сам скачаешь."
        spec={spec}
        basePath="/share"
        actions={
          <div className="flex rounded-lg border border-line p-0.5 text-xs">
            {(["light", "dark"] as const).map((c) => (
              <a key={c} href={pageQs(c)} className={`rounded-md px-2.5 py-1 ${cardTheme === c ? "bg-fg text-surface" : "text-muted hover:text-fg"}`}>
                {c === "light" ? "светлая карточка" : "тёмная карточка"}
              </a>
            ))}
          </div>
        }
      />
      <div className="grid gap-6 lg:grid-cols-[1fr_minmax(0,0.6fr)]">
        <section className="space-y-3">
          <h2 className="text-sm font-medium">Пост · 1080×1080</h2>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={img("square")} alt="Карточка для поста" className="w-full rounded-xl border border-line" />
          <a href={img("square")} download={`social-board-${spec.from}-${spec.to}-square.png`} className="inline-block rounded-lg bg-fg px-3 py-1.5 text-xs text-surface">Скачать PNG</a>
        </section>
        <section className="space-y-3">
          <h2 className="text-sm font-medium">Сторис · 1080×1920</h2>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={img("story")} alt="Карточка для сторис" className="w-full rounded-xl border border-line" />
          <a href={img("story")} download={`social-board-${spec.from}-${spec.to}-story.png`} className="inline-block rounded-lg bg-fg px-3 py-1.5 text-xs text-surface">Скачать PNG</a>
        </section>
      </div>
    </div>
  );
}
