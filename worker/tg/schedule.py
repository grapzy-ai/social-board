"""Run loop: sync at 00/06/12/18 Chisinau; alert the bot after 3 consecutive failures."""
from __future__ import annotations

import asyncio
import logging
import os
from datetime import datetime, timedelta, timezone

import httpx
from telethon import TelegramClient
from telethon.sessions import StringSession

from .collector import collect_once
from .normalize import TZ
from .sink import Sink

log = logging.getLogger("worker")
RUN_HOURS = (0, 6, 12, 18)


def next_run(now: datetime) -> datetime:
    local = now.astimezone(TZ)
    for h in RUN_HOURS:
        cand = local.replace(hour=h, minute=0, second=0, microsecond=0)
        if cand > local:
            return cand
    return (local + timedelta(days=1)).replace(hour=RUN_HOURS[0], minute=0, second=0, microsecond=0)


def send_bot_message(text: str) -> None:
    token = os.environ.get("TG_BOT_TOKEN")
    chats = [c for c in os.environ.get("TG_REPORT_CHAT_IDS", "").split(",") if c.strip()]
    if not token or not chats:
        return
    for chat in chats:
        try:
            httpx.post(f"https://api.telegram.org/bot{token}/sendMessage", json={"chat_id": chat.strip(), "text": text}, timeout=15)
        except Exception as e:  # alerts must never crash the worker
            log.warning("bot send failed: %s", e)


async def run_sync_once(client: TelegramClient, sink: Sink) -> bool:
    account_id = os.environ["TG_ACCOUNT_ID"]
    channel = os.environ["TG_CHANNEL"]
    language = os.environ.get("TG_LANGUAGE", "ru")
    started = datetime.now(timezone.utc).isoformat()
    try:
        res = await collect_once(client, channel, account_id, sink, language=language)
        sink.write_sync_run(account_id, "ok", res.posts, res.snapshots, None, started, datetime.now(timezone.utc).isoformat())
        log.info("sync ok: posts=%s snapshots=%s followers=%s", res.posts, res.snapshots, res.followers)
        return True
    except Exception as e:
        log.exception("sync failed")
        sink.write_sync_run(account_id, "error", 0, 0, str(e)[:500], started, datetime.now(timezone.utc).isoformat())
        return False


async def main_loop(once: bool = False) -> None:
    client = TelegramClient(StringSession(os.environ["TG_SESSION"]), int(os.environ["TG_API_ID"]), os.environ["TG_API_HASH"])
    await client.start()
    sink = Sink()
    failures = 0
    while True:
        ok = await run_sync_once(client, sink)
        failures = 0 if ok else failures + 1
        if failures == 3:
            send_bot_message("⚠️ Social Board: сборщик Telegram упал 3 раза подряд. Проверь воркер на Railway.")
            try:
                sink.write_signal(os.environ["TG_ACCOUNT_ID"], "sync_failing", {"consecutive_failures": failures})
            except Exception:
                pass
        if once:
            return
        nxt = next_run(datetime.now(timezone.utc))
        delay = max(60, (nxt - datetime.now(TZ)).total_seconds())
        log.info("next run at %s (%.0f s)", nxt.isoformat(), delay)
        await asyncio.sleep(delay)
