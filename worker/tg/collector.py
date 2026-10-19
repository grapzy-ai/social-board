"""Telethon collector: channel followers + per-post views/forwards/reactions (+ broadcast stats when allowed)."""
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

from telethon import TelegramClient
from telethon.tl.functions.channels import GetFullChannelRequest
from telethon.tl.functions.stats import GetBroadcastStatsRequest

from .normalize import chisinau_date, day_index, normalize_channel, normalize_message, should_snapshot
from .sink import Sink

LOOKBACK_DAYS = 90


@dataclass
class CollectResult:
    posts: int
    snapshots: int
    followers: int


def _graph_points(graph) -> list | None:
    """Best-effort: StatsGraph.json.data → parsed list, else None (async graphs skipped)."""
    try:
        import json

        data = json.loads(graph.json.data)
        return data.get("columns")
    except Exception:
        return None


async def collect_once(client: TelegramClient, channel: str, account_id: str, sink: Sink, now: datetime | None = None, language: str = "ru") -> CollectResult:
    now = now or datetime.now(timezone.utc)
    now_iso = now.isoformat()
    entity = await client.get_entity(channel)
    username = getattr(entity, "username", None) or channel.lstrip("@")
    full = await client(GetFullChannelRequest(entity))
    ch = normalize_channel(full)

    since = now - timedelta(days=LOOKBACK_DAYS)
    rows: list[dict] = []
    async for msg in client.iter_messages(entity, offset_date=None):
        if msg.date < since:
            break
        row = normalize_message(msg, username)
        if row:
            rows.append(row)

    ids = sink.upsert_posts(account_id, rows, language=language)
    existing = sink.existing_snapshot_days(list(ids.values()))
    snapshots = 0
    for r in rows:
        pid = ids.get(r["external_id"])
        if not pid:
            continue
        d = day_index(datetime.fromisoformat(r["published_at"]), now)
        if should_snapshot(d, existing.get(pid, [])):
            metrics = {"views": r["views"], "reposts": r["forwards"], "likes": r["reactions"]}
            if sink.write_snapshot(pid, d, metrics, now_iso):
                snapshots += 1

    extra: dict | None = None
    if ch["can_view_stats"]:
        try:
            stats = await client(GetBroadcastStatsRequest(channel=entity))
            extra = {
                "followers_period": {"current": stats.followers.current, "previous": stats.followers.previous},
                "views_per_post": {"current": stats.views_per_post.current, "previous": stats.views_per_post.previous},
                "shares_per_post": {"current": stats.shares_per_post.current, "previous": stats.shares_per_post.previous},
                "enabled_notifications": getattr(stats.enabled_notifications, "part", None),
                "new_followers_by_source": _graph_points(stats.new_followers_by_source_graph),
                "views_by_source": _graph_points(stats.views_by_source_graph),
            }
        except Exception as e:  # stats may be async/unavailable; never fail the sync for it
            extra = {"stats_error": str(e)[:200]}

    sink.upsert_account_daily(account_id, chisinau_date(now), ch["followers"], extra, now_iso)
    sink.mark_account_synced(account_id, now_iso)
    return CollectResult(posts=len(rows), snapshots=snapshots, followers=ch["followers"])
