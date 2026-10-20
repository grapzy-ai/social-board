"""Writes to Supabase (service role) through PostgREST. Append-only snapshots, upsert posts/daily."""
from __future__ import annotations

import os
from typing import Iterable

import httpx


class Sink:
    def __init__(self, url: str | None = None, key: str | None = None):
        self.url = (url or os.environ["SUPABASE_URL"]).rstrip("/") + "/rest/v1"
        self.key = key or os.environ["SUPABASE_SERVICE_ROLE_KEY"]
        self.http = httpx.Client(
            headers={"apikey": self.key, "Authorization": f"Bearer {self.key}", "Content-Type": "application/json"},
            timeout=30,
        )

    # --- posts ---------------------------------------------------------
    def upsert_posts(self, account_id: str, rows: Iterable[dict], language: str = "ru") -> dict[str, str]:
        """Returns {external_id: post_id}."""
        payload = [
            {
                "account_id": account_id,
                "external_id": r["external_id"],
                "format": "tg_post",
                "published_at": r["published_at"],
                "text": r["text"],
                "permalink": r["permalink"],
                "language": language,
            }
            for r in rows
        ]
        if not payload:
            return {}
        res = self.http.post(
            f"{self.url}/posts?on_conflict=account_id,external_id",
            params={"select": "id,external_id"},
            headers={"Prefer": "resolution=merge-duplicates,return=representation"},
            json=payload,
        )
        res.raise_for_status()
        return {r["external_id"]: r["id"] for r in res.json()}

    def existing_snapshot_days(self, post_ids: list[str]) -> dict[str, list[int]]:
        if not post_ids:
            return {}
        out: dict[str, list[int]] = {pid: [] for pid in post_ids}
        res = self.http.get(
            f"{self.url}/post_metrics_snapshots",
            params={"select": "post_id,day_index", "post_id": f"in.({','.join(post_ids)})"},
        )
        res.raise_for_status()
        for r in res.json():
            out.setdefault(r["post_id"], []).append(r["day_index"])
        return out

    def write_snapshot(self, post_id: str, day_index: int, metrics: dict, captured_at: str) -> bool:
        res = self.http.post(
            f"{self.url}/post_metrics_snapshots?on_conflict=post_id,day_index",
            headers={"Prefer": "resolution=ignore-duplicates,return=representation"},
            json=[{"post_id": post_id, "day_index": day_index, "captured_at": captured_at, **metrics}],
        )
        res.raise_for_status()
        return len(res.json()) > 0

    # --- account -------------------------------------------------------
    def upsert_account_daily(self, account_id: str, day: str, followers: int, extra: dict | None, captured_at: str) -> None:
        res = self.http.post(
            f"{self.url}/account_metrics_daily?on_conflict=account_id,date",
            headers={"Prefer": "resolution=merge-duplicates"},
            json=[{"account_id": account_id, "date": day, "followers": followers, "extra": extra, "captured_at": captured_at}],
        )
        res.raise_for_status()

    def mark_account_synced(self, account_id: str, when: str) -> None:
        res = self.http.patch(f"{self.url}/accounts", params={"id": f"eq.{account_id}"}, json={"last_ok_sync_at": when, "updated_at": when})
        res.raise_for_status()

    def write_sync_run(self, account_id: str, status: str, posts: int, snapshots: int, error: str | None, started_at: str, finished_at: str) -> None:
        res = self.http.post(
            f"{self.url}/sync_runs",
            json=[{"account_id": account_id, "status": status, "posts_upserted": posts, "snapshots_written": snapshots, "error": error, "started_at": started_at, "finished_at": finished_at}],
        )
        res.raise_for_status()

    def write_signal(self, account_id: str, type_: str, payload: dict) -> None:
        res = self.http.post(f"{self.url}/signals", json=[{"account_id": account_id, "type": type_, "payload": payload}])
        res.raise_for_status()
