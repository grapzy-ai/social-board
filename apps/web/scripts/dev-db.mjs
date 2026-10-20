// Local visual harness: in-memory Postgres (pglite) on a TCP port with the real migration and demo data.
// Usage: node scripts/dev-db.mjs  → DATABASE_URL=postgres://postgres:postgres@127.0.0.1:5433/postgres
import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const mig = (f) => readFileSync(path.join(here, "../../../supabase/migrations", f), "utf8");
const sql = mig("0001_core.sql").split("-- Row Level Security")[0] + "\n" + mig("0006_factory.sql");
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

// --- content factory: three inbox items + one generated package
const inb1 = await ins(`insert into inbox_items (source, kind, text, transcript, tags, language, status, created_at) values ('bot','voice',null,'Еду в Сочи знакомиться с руководителем продаж. Два дня в горах, разговоры не про воронку. Понял, что знаю голос человека лучше, чем его походку.', '{"pillar":"build","format":"reel","kind":"idea","language":"ru","summary":"Еду к команде в Сочи — первая встреча вживую","hooks":["У меня 30+ человек в команде. Руководителя продаж увидел вживую впервые","Первая командировка не к клиенту, а к своему сотруднику"]}','ru','used', now() - interval '2 hours') returning id`);
await ins(`insert into inbox_items (source, kind, text, media_ref, tags, language, status, created_at) values ('bot','link','https://www.instagram.com/reel/C7eyTFNMj9m/','https://www.instagram.com/reel/C7eyTFNMj9m/', '{"pillar":"influence","format":"carousel","kind":"reference","language":"ru","summary":"Референс: карусель «скелет ролика» на 10 слайдов","hooks":[]}','ru','sorted', now() - interval '50 minutes') returning id`);
await ins(`insert into inbox_items (source, kind, text, status, created_at) values ('bot','voice',null,'new', now() - interval '5 minutes') returning id`);
const pkg = [
  ['reel','Каждое пятое размещение не окупается', {script:"[0–2] ГОЛОВА: «Инфлюенс-маркетинг нельзя посчитать». Мы посчитали. 523 размещения.\n[2–8] ЭКРАН стр. 2: На 1 рубль бюджета — 3,1 рубля заказов. ДРР 32%.\n[8–20] ЭКРАН стр. 8: Каждое пятое размещение не окупилось. Каждое четвёртое дало больше 4,5.\n[20–30] ЭКРАН стр. 10: Кампания прогнозируется — факт разошёлся с прогнозом на 11%.\n[30–45] ГОЛОВА: Весь отчёт — бесплатно. Пиши «ИССЛЕДОВАНИЕ».", hooks:["«Инфлюенс нельзя посчитать». Мы посчитали 523 размещения","3,1 рубля на рубль. Данные, не обещания","Селлеры спорили. Мы посчитали"], cover:"Каждое пятое не окупается", angle:"teach", hookMechanic:"number", funnel:"mofu"}, 'ready'],
  ['reel','Команда 0—01 · Сочи', {script:"[0–2] ТЕКСТ: У меня 30+ человек в команде. Руководителя продаж я увидел вживую впервые.\n[2–10] ГОЛОС: Influencio с 2019 на удалёнке…", hooks:["Я семь лет плачу зарплату людям, которых не видел [?]","Первая командировка не к клиенту, а к сотруднику"], cover:"30+ человек на удалёнке. Еду знакомиться", angle:"story", hookMechanic:"confession", funnel:"tofu"}, 'draft'],
  ['threads','Threads 1', {text:"Блогеры на WB и Ozon приносят 3,1 рубля на рубль бюджета.\nЭто 523 размещения, 6 брендов, два года.\nСеллеры, какой ДРР получался у вас?"}, 'approved'],
  ['threads','Threads 2', {text:"Каждое пятое размещение у блогера не окупается.\nИ это нормальная кампания, если остальные четыре дают от 1 до 4,8.\nКто до сих пор оценивает блогеров по одному посту?"}, 'draft'],
  ['carousel','Что показали 523 размещения у блогеров на WB и Ozon', {slides:["Что показали 523 размещения у блогеров на WB и Ozon · цифры, а не мнения","На 1 ₽ бюджета — 3,1 ₽ заказов. ДРР 32%.","«Типичного» размещения не существует: разброс в 4 раза","Каждое пятое не окупается. Каждое четвёртое даёт больше 4,5 ₽","Отдельный пост — лотерея. Кампания из 10+ — точность около 90%","Нано 4,0 · микро 2,4 · мидл 1,8","Telegram: ROAS 4,3, окупаются 93%","Промокод ловит в 1,5 раза больше заказов, чем ссылка","Селлеру: портфель, а не пост · ДРР кампании · микро и нано первыми · промокод до старта","Весь отчёт — бесплатно. Пиши ИССЛЕДОВАНИЕ ↓"], caption:"Мы посчитали 523 размещения у блогеров до заказа на маркетплейсе. Пиши «ИССЛЕДОВАНИЕ» — пришлю PDF."}, 'draft'],
  ['story','Сторис 1', {text:"Скрин стр. 2 отчёта + опрос: «Считали продажи от блогеров до заказа?» (опрос: да / нет / пробовали)"}, 'draft'],
  ['tg','Мы посчитали 523 размещения у блогеров до заказа на маркетплейсе', {text:"Мы посчитали 523 размещения у блогеров до заказа на маркетплейсе. Рынок три года спорил, можно ли так. Можно.\n\nДва года назад я устал от разговора «блогеры не считаются». Каждый созвон с селлером заканчивался одинаково: «охваты красивые, а продажи где?».\n\n• На 1 рубль бюджета кампании блогеры приносят 3,1 рубля заказов. ДРР по всей базе — 32%.\n• Все 8 кампаний окупились.\n\nPDF прикрепляю. Какой ДРР получался у вас и как считали?"}, 'approved'],
];
for (const [type, title, body, status] of pkg) {
  await db.query(`insert into drafts (inbox_item_id, account_id, type, title, body, status, approved_at) values ($1,$2,$3,$4,$5,$6, case when $6 in ('approved') then now() else null end)`, [inb1.id, type === 'tg' ? tg.id : null, type, title, JSON.stringify(body), status]);
}
await db.query(`insert into drafts (inbox_item_id, account_id, type, title, body, status, published_at, published_url) values ($1,$2,'tg','Старт серии «Команда»',$3,'published', now() - interval '1 day','https://t.me/vadimbordian/1')`, [inb1.id, tg.id, JSON.stringify({text:"Старт серии «Команда»\n\nОбъезжаю всех лично. Первый — Сочи."})]);

const server = new PGLiteSocketServer({ db, port: 5433, host: "127.0.0.1" });
await server.start();
console.log("dev-db ready on 127.0.0.1:5433 (accounts:", Object.keys(base).length, ")");
