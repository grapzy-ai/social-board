import { desc, eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { resolveSegment, segmentLanguage, SEGMENT_COOKIE } from "@/lib/ui/segment";
import { getDb } from "@/lib/db/client";
import { accounts, goals, manualMetrics, syncRuns } from "@/lib/db/schema";
import { addAccountAction, manualMetricsAction, setGoalAction, syncNowAction } from "./actions";
import { chisinauDate } from "@/lib/time";
import { PLATFORM_LABEL } from "@/lib/ui/platform";
import { PageHeader } from "@/components/shell/PageHeader";

export const dynamic = "force-dynamic";


function monthValue(d = new Date()) {
  return d.toISOString().slice(0, 7);
}

export default async function AccountsSettingsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const db = getDb();
  const segLang = segmentLanguage(resolveSegment((await cookies()).get(SEGMENT_COOKIE)?.value));
  const rows = await db
    .select()
    .from(accounts)
    .where(segLang ? eq(accounts.language, segLang) : undefined)
    .orderBy(accounts.platform, accounts.handle);
  const goalRows = await db.select().from(goals);
  const runs = await db.select().from(syncRuns).orderBy(desc(syncRuns.startedAt)).limit(20);
  const manualRows = await db.select().from(manualMetrics).orderBy(desc(manualMetrics.date)).limit(5);
  const today = chisinauDate(new Date());
  const MANUAL_PLATFORMS = new Set(["linkedin", "vk", "youtube", "tiktok", "x"]);
  const thisMonth = `${monthValue()}-01`;

  return (
    <div className="space-y-10">
      <div>
        <PageHeader title="Аккаунты" subtitle="Токены хранятся зашифрованными и нигде не показываются." />
        {sp.connected && <p className="-mt-3 mb-4 text-sm text-accent">Подключено: {sp.connected}</p>}
        {sp.error && <p className="-mt-3 mb-4 text-sm text-bad">Ошибка: {sp.error}</p>}
      </div>

      <section className="rounded-xl border border-line p-5">
        <h2 className="mb-4 text-lg font-medium">Подключённые</h2>
        <table className="w-full text-sm">
          <thead className="text-left text-muted">
            <tr>
              <th className="py-2">Площадка</th>
              <th>Хендл</th>
              <th>Сегмент</th>
              <th>Роль</th>
              <th>Статус</th>
              <th>Токен до</th>
              <th>Последний синк</th>
              <th>Цель месяца</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((a) => {
              const g = goalRows.find((x) => x.accountId === a.id && x.month === thisMonth);
              return (
                <tr key={a.id} className="border-t border-line">
                  <td className="py-2">{PLATFORM_LABEL[a.platform] ?? a.platform}</td>
                  <td>@{a.handle}</td>
                  <td>{a.language.toUpperCase()}</td>
                  <td>{a.role}</td>
                  <td className={a.status === "active" ? "" : "text-red-400"}>{a.status}</td>
                  <td>{a.tokenExpiresAt ? a.tokenExpiresAt.toISOString().slice(0, 10) : "—"}</td>
                  <td>{a.lastOkSyncAt ? a.lastOkSyncAt.toISOString().replace("T", " ").slice(0, 16) : "—"}</td>
                  <td>
                    <form action={setGoalAction} className="flex items-center gap-1">
                      <input type="hidden" name="accountId" value={a.id} />
                      <input type="hidden" name="month" value={monthValue()} />
                      <input name="target" type="number" defaultValue={g?.target ?? ""} placeholder="подписчики" className="w-24 rounded bg-card px-2 py-1" />
                      <button className="rounded bg-line px-2 py-1 hover:bg-line">ok</button>
                    </form>
                  </td>
                  <td>
                    {(a.platform === "threads" || a.platform === "instagram") && (
                      <form action={syncNowAction}>
                        <input type="hidden" name="accountId" value={a.id} />
                        <button className="rounded bg-accent px-2 py-1 text-accent-fg">Синк</button>
                      </form>
                    )}
                    {MANUAL_PLATFORMS.has(a.platform) && (
                      <form action={manualMetricsAction} className="flex items-center gap-1" title="Ручной ввод: цифры из статистики площадки">
                        <input type="hidden" name="accountId" value={a.id} />
                        <input name="followers" type="number" min={0} placeholder="подписчики" className="w-24 rounded bg-card px-2 py-1" />
                        <input name="views" type="number" min={0} placeholder="просмотры" className="w-24 rounded bg-card px-2 py-1" />
                        <input name="date" type="date" defaultValue={today} className="rounded bg-card px-2 py-1" />
                        <button className="rounded bg-line px-2 py-1">записать</button>
                      </form>
                    )}
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={9} className="py-4 text-muted">Пока пусто.</td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      {manualRows.length > 0 && (
        <section className="rounded-xl border border-line p-5">
          <h2 className="mb-2 text-lg font-medium">Ручные записи</h2>
          <p className="mb-3 text-sm text-muted">LinkedIn и площадки без API — цифры, которые ты вводишь сам. Подписчики попадают в Обзор и на график.</p>
          <ul className="space-y-1 text-sm">
            {manualRows.map((m) => {
              const acc = rows.find((a) => a.id === m.accountId);
              return (
                <li key={m.id} className="flex gap-3 tabular-nums">
                  <span className="text-muted">{m.date}</span>
                  <span>{acc ? `${PLATFORM_LABEL[acc.platform]} @${acc.handle}` : m.accountId.slice(0, 8)}</span>
                  <span>подписчики {m.followers ?? "—"}</span>
                  <span>просмотры {m.views ?? "—"}</span>
                  {m.note && <span className="text-muted">{m.note}</span>}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section className="grid gap-6 md:grid-cols-2">
        <div className="rounded-xl border border-line p-5">
          <h2 className="mb-2 text-lg font-medium">Threads — через OAuth</h2>
          <p className="mb-4 text-sm text-muted">Нажми, разреши доступ в Threads — токен ляжет в базу сам.</p>
          <div className="flex gap-3">
            <a className="rounded bg-accent px-3 py-2 text-sm text-accent-fg" href="/api/auth/threads/start?language=ru&role=focus">Подключить Threads RU</a>
            <a className="rounded border border-line px-3 py-2 text-sm" href="/api/auth/threads/start?language=en&role=focus">Threads EN</a>
          </div>
        </div>

        <form action={addAccountAction} className="space-y-3 rounded-xl border border-line p-5">
          <h2 className="text-lg font-medium">Добавить аккаунт вручную</h2>
          <p className="text-sm text-muted">Instagram: токен из Meta Dashboard (Generate token), external id — <code>user_id</code> из <code>/me</code>. Telegram/TikTok/VK/YouTube/LinkedIn — без токена, только для учёта.</p>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <label className="flex flex-col gap-1">Площадка
              <select name="platform" className="rounded bg-card px-2 py-1">
                {PLATFORMS_ORDER.map((p) => <option key={p} value={p}>{PLATFORM_LABEL[p]}</option>)}
              </select>
            </label>
            <label className="flex flex-col gap-1">Хендл<input name="handle" required className="rounded bg-card px-2 py-1" /></label>
            <label className="flex flex-col gap-1">External user id<input name="externalUserId" className="rounded bg-card px-2 py-1" /></label>
            <label className="flex flex-col gap-1">Язык
              <select name="language" className="rounded bg-card px-2 py-1"><option value="ru">RU</option><option value="en">EN</option></select>
            </label>
            <label className="flex flex-col gap-1">Роль
              <select name="role" className="rounded bg-card px-2 py-1"><option value="focus">focus</option><option value="mirror">mirror</option><option value="lifestyle">lifestyle</option></select>
            </label>
            <label className="flex flex-col gap-1">Токен действует, дней<input name="expiresInDays" type="number" defaultValue={60} className="rounded bg-card px-2 py-1" /></label>
            <label className="col-span-2 flex flex-col gap-1">Токен (не сохраняется в открытом виде)<input name="token" type="password" autoComplete="off" className="rounded bg-card px-2 py-1" /></label>
          </div>
          <button className="rounded bg-fg px-3 py-2 text-sm text-surface">Сохранить</button>
        </form>
      </section>

      <section className="rounded-xl border border-line p-5">
        <h2 className="mb-3 text-lg font-medium">Последние синки</h2>
        <ul className="space-y-1 text-sm">
          {runs.map((r) => (
            <li key={r.id} className={r.status === "ok" ? "text-fg" : "text-red-400"}>
              {r.startedAt.toISOString().replace("T", " ").slice(0, 16)} · {r.status} · постов {r.postsUpserted} · снимков {r.snapshotsWritten} {r.error ? `· ${r.error}` : ""}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

const PLATFORMS_ORDER = ["instagram", "threads", "telegram", "tiktok", "vk", "youtube", "linkedin", "x"] as const;
