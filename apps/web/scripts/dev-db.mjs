// Local visual harness: in-memory Postgres (pglite) on a TCP port with the real migration and demo data.
// Usage: node scripts/dev-db.mjs  → DATABASE_URL=postgres://postgres:postgres@127.0.0.1:5433/postgres
import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const sql = readFileSync(path.join(here, "../../../supabase/migrations/0001_core.sql"), "utf8").split("-- Row Level Security")[0];
const db = new PGlite();
await db.exec(sql);

const today = new Date();
const ymd = (d) => d.toISOString().slice(0, 10);
const daysAgo = (n) => new Date(today.getTime() - n * 86_400_000);

const ins = async (q, params) => (await db.query(q, params)).rows[0];
const tg = await ins(`insert into accounts (platform, handle, language, role) values ('telegram','vadimbordian','ru','focus') returning id`);
const ig = await ins(`insert into accounts (platform, handle, language, role, external_user_id) values ('instagram','vadim.bordian','ru','focus','1') returning id`);
const th = await ins(`insert into accounts (platform, handle, language, role, external_user_id) values ('threads','vadim.bordian','ru','focus','2') returning id`);
const en = await ins(`insert into accounts (platform, handle, language, role, external_user_id) values ('instagram','vadim.en','en','focus','3') returning id`);

const base = { [tg.id]: 300, [ig.id]: 650, [th.id]: 80, [en.id]: 40 };
const slope = { [tg.id]: 1.6, [ig.id]: 2.4, [th.id]: 0.9, [en.id]: 0.4 };
for (let n = 44; n >= 0; n--) {
  for (const id of Object.keys(base)) {
    if (n === 12 && id === th.id) continue; // a gap
    const f = Math.round(base[id] + slope[id] * (44 - n) + (n % 5 === 0 ? 3 : 0));
    await db.query(`insert into account_metrics_daily (account_id, date, followers) values ($1,$2,$3)`, [id, ymd(daysAgo(n)), f]);
  }
}
await db.query(`insert into goals (account_id, month, metric, target, comment) values ($1, $2, 'followers', 450, 'Темп +2 в день — к концу месяца будет около 400, до цели не дотянешь. Один пост-разбор в неделю обычно даёт +15–20.')`, [tg.id, ymd(today).slice(0, 7) + "-01"]);
await db.query(`insert into goals (account_id, month, metric, target) values ($1, $2, 'followers', 800)`, [ig.id, ymd(today).slice(0, 7) + "-01"]);

const texts = ["Бренды покупают охваты. Я делаю из блогеров канал, который реально продаёт — разбор на цифрах", "5 000 кампаний спустя: три ошибки, которые селлеры повторяют каждый сезон", "Как мы предсказали продажи до запуска и ошиблись на 7%", "Почему CPM у блогера — не метрика, а повод поспорить", "Вайбкодинг: собрал дашборд соцсетей за два дня. Показываю внутрянку", "Подкаст «Вадим, где блогеры?» — новый выпуск про маркетплейсы", "Отцовство и фаундерство: один календарь на двоих", "Разбор рекламы Яндекса у блогеров: что сработало"];
let k = 0;
for (const [accId, format] of [[tg.id, "tg_post"], [ig.id, "reel"], [th.id, "thread"], [en.id, "reel"]]) {
  for (let i = 0; i < 8; i++) {
    const age = 2 + i * 4;
    const p = await ins(`insert into posts (account_id, external_id, format, published_at, text, language) values ($1,$2,$3,$4,$5,$6) returning id`, [accId, `${format}-${i}`, format, daysAgo(age).toISOString(), texts[(k++) % texts.length], accId === en.id ? "en" : "ru"]);
    const views = Math.round((format === "reel" ? 2200 : 900) * [0.3, 0.7, 1, 1.2, 3.4, 0.5, 0.9, 1.8][i]);
    for (const d of [1, 3, 7, 11].filter((x) => x <= age)) {
      await db.query(`insert into post_metrics_snapshots (post_id, day_index, views, likes, comments, saves) values ($1,$2,$3,$4,$5,$6)`, [p.id, d, Math.round(views * (d / 11) ** 0.5), Math.round(views / 40), Math.round(views / 200), Math.round(views / 90)]);
    }
  }
  await db.query(`insert into benchmarks (account_id, format, median_views, sample_size, provisional, computed_on) values ($1,$2,$3,6,false,$4)`, [accId, format, format === "reel" ? 2200 : 900, ymd(today)]);
}
await db.query(`insert into signals (account_id, type, payload) values ($1,'token_expiring','{}'), ($2,'day11_due','{}')`, [ig.id, th.id]);

const server = new PGLiteSocketServer({ db, port: 5433, host: "127.0.0.1" });
await server.start();
console.log("dev-db ready on 127.0.0.1:5433 (accounts:", Object.keys(base).length, ")");
