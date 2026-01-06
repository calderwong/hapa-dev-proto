from __future__ import annotations

import json
import time
import urllib.error
import urllib.request
from dataclasses import dataclass
from typing import Any, Optional


@dataclass(frozen=True)
class ZImageClient:
    base_url: str
    token: str

    def _http_json(
        self,
        method: str,
        path: str,
        *,
        payload: Optional[dict],
        timeout_seconds: Optional[float] = None,
    ) -> dict:
        url = self.base_url.rstrip("/") + "/" + path.lstrip("/")
        data = None
        headers: dict[str, str] = {"Authorization": f"Bearer {self.token}"}

        if payload is not None:
            data = json.dumps(payload).encode("utf-8")
            headers["Content-Type"] = "application/json"

        req = urllib.request.Request(url=url, method=method, data=data, headers=headers)

        try:
            if timeout_seconds is None:
                res = urllib.request.urlopen(req)
            else:
                res = urllib.request.urlopen(req, timeout=float(timeout_seconds))
            with res:
                body = res.read()
                return json.loads(body.decode("utf-8")) if body else {}
        except urllib.error.HTTPError as exc:
            body = exc.read() if hasattr(exc, "read") else b""
            text = body.decode("utf-8", errors="replace")
            raise RuntimeError(f"HTTP {exc.code}: {text}")

    def _http_bytes(
        self,
        method: str,
        path: str,
        *,
        timeout_seconds: Optional[float] = None,
    ) -> tuple[bytes, Optional[str]]:
        url = self.base_url.rstrip("/") + "/" + path.lstrip("/")
        headers: dict[str, str] = {"Authorization": f"Bearer {self.token}"}
        req = urllib.request.Request(url=url, method=method, headers=headers)

        try:
            if timeout_seconds is None:
                res = urllib.request.urlopen(req)
            else:
                res = urllib.request.urlopen(req, timeout=float(timeout_seconds))
            with res:
                body = res.read()
                mime = res.headers.get("Content-Type")
                return body, mime
        except urllib.error.HTTPError as exc:
            body = exc.read() if hasattr(exc, "read") else b""
            text = body.decode("utf-8", errors="replace")
            raise RuntimeError(f"HTTP {exc.code}: {text}")

    def health(self, *, timeout_seconds: float = 10.0) -> dict:
        url = self.base_url.rstrip("/") + "/health"
        req = urllib.request.Request(url=url, method="GET")
        try:
            res = urllib.request.urlopen(req, timeout=float(timeout_seconds))
            with res:
                body = res.read()
                return json.loads(body.decode("utf-8")) if body else {}
        except urllib.error.HTTPError as exc:
            body = exc.read() if hasattr(exc, "read") else b""
            text = body.decode("utf-8", errors="replace")
            raise RuntimeError(f"HTTP {exc.code}: {text}")

    def capabilities(self) -> dict:
        return self._http_json("GET", "/capabilities", payload=None, timeout_seconds=30.0)

    def submit_generation(self, payload: dict) -> str:
        res = self._http_json("POST", "/v1/images/generations", payload=payload, timeout_seconds=60.0)
        task_id = res.get("task_id") if isinstance(res, dict) else None
        if not task_id:
            raise RuntimeError("Missing task_id in response")
        return str(task_id)

    def get_task(self, task_id: str) -> dict:
        return self._http_json("GET", f"/v1/tasks/{task_id}", payload=None, timeout_seconds=30.0)

    def wait_tasks_done(
        self,
        task_ids: list[str],
        *,
        timeout_seconds: float,
        poll_interval_seconds: float,
    ) -> dict[str, dict]:
        deadline = time.time() + float(timeout_seconds)
        remaining = set(str(t) for t in task_ids)
        done: dict[str, dict] = {}

        while remaining:
            if time.time() >= deadline:
                raise RuntimeError(f"Timed out waiting for tasks ({len(remaining)} remaining)")

            for task_id in list(remaining):
                try:
                    task = self.get_task(task_id)
                except Exception:
                    continue

                status = task.get("status") if isinstance(task, dict) else None
                if status in {"succeeded", "failed"}:
                    done[task_id] = task
                    remaining.discard(task_id)

            if remaining:
                time.sleep(max(0.05, float(poll_interval_seconds)))

        return done

    def download_asset(self, asset_id: str) -> tuple[bytes, Optional[str]]:
        return self._http_bytes("GET", f"/v1/assets/{asset_id}/download", timeout_seconds=120.0)


def get_task_result_asset_id(task: dict) -> str:
    if not isinstance(task, dict):
        raise RuntimeError("Invalid task")
    status = task.get("status")
    if status != "succeeded":
        raise RuntimeError(f"Task not succeeded: {status}")
    result = task.get("result")
    if not isinstance(result, dict):
        raise RuntimeError("Missing task result")
    asset_id = result.get("asset_id")
    if not asset_id:
        raise RuntimeError("Missing asset_id")
    return str(asset_id)


def safe_number(value: Any) -> Optional[float]:
    if isinstance(value, (int, float)):
        return float(value)
    return None
