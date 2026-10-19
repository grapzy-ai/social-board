from datetime import datetime, timezone
from types import SimpleNamespace as NS

from tg.normalize import (
    SNAPSHOT_DAYS,
    chisinau_date,
    day_index,
    normalize_channel,
    normalize_message,
    should_snapshot,
)


def _msg(**kw):
    base = dict(id=42, date=datetime(2026, 10, 10, 9, 0, tzinfo=timezone.utc), message="Пост", views=1500, forwards=12, reactions=None, media=None)
    base.update(kw)
    return NS(**base)


def test_normalize_message_maps_views_forwards_and_sums_reactions():
    m = _msg(reactions=NS(results=[NS(count=30), NS(count=5)]))
    row = normalize_message(m, "vadimbordian")
    assert row["external_id"] == "42"
    assert row["views"] == 1500
    assert row["forwards"] == 12
    assert row["reactions"] == 35
    assert row["text"] == "Пост"
    assert row["permalink"] == "https://t.me/vadimbordian/42"
    assert row["published_at"] == "2026-10-10T09:00:00+00:00"


def test_normalize_message_without_reactions_gives_zero():
    assert normalize_message(_msg(), "c")["reactions"] == 0


def test_service_message_without_views_is_skipped():
    assert normalize_message(_msg(views=None), "c") is None


def test_normalize_channel_reads_followers_and_stats_flag():
    full = NS(full_chat=NS(participants_count=350, can_view_stats=True))
    assert normalize_channel(full) == {"followers": 350, "can_view_stats": True}


def test_day_index_uses_chisinau_calendar_days():
    published = datetime(2026, 10, 19, 20, 30, tzinfo=timezone.utc)  # 23:30 local
    now = datetime(2026, 10, 20, 5, 0, tzinfo=timezone.utc)  # 08:00 next local day
    assert day_index(published, now) == 1
    assert chisinau_date(published) == "2026-10-19"


def test_snapshot_rules_match_web():
    assert SNAPSHOT_DAYS == [1, 3, 7, 11, 30]
    assert should_snapshot(11, [1, 3, 7]) is True
    assert should_snapshot(11, [1, 3, 7, 11]) is False
    assert should_snapshot(37, [30]) is True
    assert should_snapshot(36, [30]) is False
    assert should_snapshot(2, [1]) is False
