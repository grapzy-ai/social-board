"""Pure transforms for Telegram data. Mirrors apps/web/src/lib/time.ts rules."""
from __future__ import annotations

from datetime import date, datetime, timezone
from typing import Any, Optional
from zoneinfo import ZoneInfo

TZ = ZoneInfo("Europe/Chisinau")
SNAPSHOT_DAYS = [1, 3, 7, 11, 30]


def chisinau_date(dt: datetime) -> str:
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(TZ).date().isoformat()


def day_index(published_at: datetime, now: datetime) -> int:
    a = date.fromisoformat(chisinau_date(published_at))
    b = date.fromisoformat(chisinau_date(now))
    return (b - a).days


def should_snapshot(day_idx: int, existing: list[int]) -> bool:
    if day_idx in existing:
        return False
    if day_idx in SNAPSHOT_DAYS:
        return True
    return day_idx > 30 and (day_idx - 30) % 7 == 0


def _reactions_total(reactions: Any) -> int:
    if not reactions or not getattr(reactions, "results", None):
        return 0
    return int(sum(getattr(r, "count", 0) or 0 for r in reactions.results))


def normalize_message(msg: Any, channel_username: str) -> Optional[dict]:
    """Channel post → row. Service messages (no views) → None."""
    views = getattr(msg, "views", None)
    if views is None:
        return None
    dt: datetime = msg.date
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return {
        "external_id": str(msg.id),
        "published_at": dt.isoformat(),
        "text": getattr(msg, "message", None) or None,
        "views": int(views),
        "forwards": int(getattr(msg, "forwards", 0) or 0),
        "reactions": _reactions_total(getattr(msg, "reactions", None)),
        "permalink": f"https://t.me/{channel_username}/{msg.id}",
        "has_media": getattr(msg, "media", None) is not None,
    }


def normalize_channel(full: Any) -> dict:
    fc = full.full_chat
    return {
        "followers": int(getattr(fc, "participants_count", 0) or 0),
        "can_view_stats": bool(getattr(fc, "can_view_stats", False)),
    }
