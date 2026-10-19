# Telegram worker (Railway)

Собирает подписчиков канала, просмотры/репосты/реакции каждого поста (90 дней) и, если Telegram даёт статистику, источники подписчиков и просмотров. Пишет в Supabase. Расписание — 00/06/12/18 по Кишинёву.

## Переменные
`TG_API_ID`, `TG_API_HASH` (my.telegram.org), `TG_SESSION` (из `--login`), `TG_CHANNEL` (@username канала), `TG_ACCOUNT_ID` (uuid аккаунта telegram из таблицы `accounts`), `TG_LANGUAGE` (ru|en), `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `TG_BOT_TOKEN`, `TG_REPORT_CHAT_IDS` (через запятую).

## Первый запуск (локально, один раз)
```
cd worker && pip install -e . && python main.py --login   # введёшь код из Telegram → получишь TG_SESSION
python main.py --once                                      # проверка одного прогона
```
Дальше — деплой на Railway из папки `worker/` (Dockerfile), переменные выше, команда по умолчанию `python main.py`.
