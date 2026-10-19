# Social Board

Дашборд и автоматизация соцсетей Вадима Бордияна. Спека и план — в `docs/superpowers/`.

- `apps/web` — Next.js (Vercel): UI, сборщики Threads/Instagram, cron-роуты, MCP.
- `worker` — Python/Telethon (Railway): сборщик Telegram, отчёты в бот.
- `supabase/migrations` — схема и расписания pg_cron.

## Запуск
```
pnpm install
cp .env.example apps/web/.env.local   # заполнить
pnpm -F web dev
pnpm test
```
Миграции применяются к проекту Supabase `vadim-social` по порядку номеров.
