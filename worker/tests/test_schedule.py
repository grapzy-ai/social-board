from datetime import datetime, timezone

from tg.schedule import next_run
from tg.normalize import TZ


def test_next_run_picks_the_next_six_hour_slot_in_chisinau():
    # 10:30 UTC = 13:30 Chisinau (UTC+3) → next slot 18:00 local
    now = datetime(2026, 10, 19, 10, 30, tzinfo=timezone.utc)
    nxt = next_run(now)
    assert nxt.tzinfo is not None
    assert nxt.astimezone(TZ).hour == 18 and nxt.astimezone(TZ).minute == 0


def test_next_run_wraps_to_midnight_after_the_last_slot():
    now = datetime(2026, 10, 19, 20, 30, tzinfo=timezone.utc)  # 23:30 local
    nxt = next_run(now).astimezone(TZ)
    assert (nxt.day, nxt.hour) == (20, 0)
