from __future__ import annotations

import base64
import hashlib
import json
import uuid
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Callable, Optional

from .config import Settings
from .zimage_client import ZImageClient, get_task_result_asset_id


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _sha256_bytes(data: bytes) -> str:
    h = hashlib.sha256()
    h.update(data)
    return h.hexdigest()


def _maybe_relative(p: Path, root: Path) -> str:
    try:
        return str(p.relative_to(root))
    except Exception:
        return str(p)


def _guess_ext(mime: Optional[str], payload: bytes) -> str:
    if mime == "image/png":
        return ".png"
    if mime in {"image/jpg", "image/jpeg"}:
        return ".jpg"
    if mime == "image/webp":
        return ".webp"
    if payload.startswith(b"\x89PNG\r\n\x1a\n"):
        return ".png"
    if payload.startswith(b"\xff\xd8"):
        return ".jpg"
    if payload.startswith(b"RIFF") and payload[8:12] == b"WEBP":
        return ".webp"
    return ".img"


def _decode_base64_image(value: str) -> bytes:
    v = str(value or "").strip()
    if not v:
        raise RuntimeError("Missing base64 image")
    if v.startswith("data:"):
        comma = v.find(",")
        if comma == -1:
            raise RuntimeError("Invalid data URI")
        v = v[comma + 1 :]
    return base64.b64decode(v.encode("ascii"))


@dataclass(frozen=True)
class VariantSpec:
    variant_id: int
    slug: str
    prompt: str


@dataclass(frozen=True)
class PoseSpec:
    pose_id: int
    slug: str
    prompt: str


def default_variants() -> list[VariantSpec]:
    return [
        VariantSpec(0, "fire", "fire-element warrior, ember aura, molten sigils"),
        VariantSpec(1, "water", "water-themed ceremonial robes, flowing fabric, sea glyphs"),
        VariantSpec(2, "techwear", "techwear rogue, neon seams, tactical straps"),
        VariantSpec(3, "cosmic", "ritual cosmic armor, star-metal plating, halo of runes"),
        VariantSpec(4, "street_samurai", "street samurai hoodie, katana silhouette, urban dusk"),
        VariantSpec(5, "monk", "soft monk robes with sigils, calm presence, sacred thread"),
        VariantSpec(6, "mirrorworld", "mirrorworld version, inverted colors, reflection fractals"),
    ]


def default_poses() -> list[PoseSpec]:
    return [
        PoseSpec(0, "proud", "standing proud, full body"),
        PoseSpec(1, "casting", "casting a spell, hands glowing"),
        PoseSpec(2, "thought", "sitting in thought"),
        PoseSpec(3, "walking", "walking calmly"),
        PoseSpec(4, "leaping", "leaping forward"),
        PoseSpec(5, "shield", "shield raised"),
        PoseSpec(6, "prayer", "hands in prayer"),
        PoseSpec(7, "teaching", "teaching a student"),
        PoseSpec(8, "floating", "floating in meditation"),
    ]


def _build_prompt(*parts: Optional[str]) -> str:
    cleaned = [str(p).strip() for p in parts if str(p or "").strip()]
    return ", ".join(cleaned)


def run_lineage(
    settings: Settings,
    *,
    avatar_name: str,
    base_prompt: Optional[str] = None,
    base_image_asset_id: Optional[str] = None,
    base_image_base64: Optional[str] = None,
    model: str = "z-image-turbo",
    negative_prompt: Optional[str] = None,
    steps: Optional[int] = None,
    seed: Optional[int] = None,
    width: Optional[int] = None,
    height: Optional[int] = None,
    quantize: Optional[int] = None,
    guidance: Optional[float] = None,
    low_ram: bool = False,
    image_strength: Optional[float] = 0.55,
    variants: Optional[list[str]] = None,
    poses: Optional[list[str]] = None,
    timeout_seconds: float = 3600.0,
    poll_interval_seconds: float = 1.0,
    progress_cb: Optional[Callable[[str, float], None]] = None,
) -> dict:
    name = str(avatar_name or "").strip()
    if not name:
        raise RuntimeError("Missing avatar_name")

    if not str(settings.upstream_token or "").strip():
        raise RuntimeError(
            "Missing upstream token (set HAPA_AVATAR_UPSTREAM_TOKEN or HAPA_MEDIA_HUB_TOKEN/HAPA_MEDIA_NODE_TOKEN)"
        )

    client = ZImageClient(base_url=settings.upstream_base_url, token=settings.upstream_token)

    out_dir = (settings.avatars_root / name).resolve()
    out_dir.mkdir(parents=True, exist_ok=True)

    def report(stage: str, progress: float) -> None:
        if progress_cb is not None:
            try:
                progress_cb(stage, float(progress))
            except Exception:
                pass

    lineage_id = uuid.uuid4().hex
    created_at = _now()

    report("base", 0.01)

    base_asset_id = str(base_image_asset_id or "").strip() or None
    base_blob: Optional[bytes] = None
    base_mime: Optional[str] = None

    if base_asset_id:
        base_blob, base_mime = client.download_asset(base_asset_id)
    elif base_prompt:
        payload: dict = {
            "mode": "txt2img",
            "prompt": str(base_prompt),
            "negative_prompt": negative_prompt,
            "model": model,
            "steps": steps,
            "seed": seed,
            "width": width,
            "height": height,
            "quantize": quantize,
            "guidance": guidance,
            "low_ram": bool(low_ram),
        }
        payload = {k: v for (k, v) in payload.items() if v is not None}
        base_task_id = client.submit_generation(payload)
        base_task = client.wait_tasks_done(
            [base_task_id],
            timeout_seconds=float(timeout_seconds),
            poll_interval_seconds=float(poll_interval_seconds),
        )[base_task_id]
        base_asset_id = get_task_result_asset_id(base_task)
        base_blob, base_mime = client.download_asset(base_asset_id)
    elif base_image_base64:
        base_blob = _decode_base64_image(base_image_base64)
    else:
        raise RuntimeError("Missing base_prompt or base_image_asset_id or base_image_base64")

    if base_blob is None:
        raise RuntimeError("Failed to resolve base image")

    base_ext = _guess_ext(base_mime, base_blob)
    base_path = (out_dir / ("base" + base_ext)).resolve()
    base_path.write_bytes(base_blob)
    base_sha = _sha256_bytes(base_blob)

    report("base", 0.1)

    variant_specs: list[VariantSpec]
    if variants is None:
        variant_specs = default_variants()
    else:
        variant_specs = [VariantSpec(i, f"v{i}", str(p)) for i, p in enumerate(list(variants))]

    pose_specs: list[PoseSpec]
    if poses is None:
        pose_specs = default_poses()
    else:
        pose_specs = [PoseSpec(i, f"p{i}", str(p)) for i, p in enumerate(list(poses))]

    report("variants", 0.12)

    variant_task_ids: list[str] = []
    variant_task_meta: dict[str, dict] = {}

    for v in variant_specs:
        v_prompt = _build_prompt(base_prompt, "same character", v.prompt)
        payload: dict = {
            "mode": "img2img",
            "prompt": v_prompt,
            "negative_prompt": negative_prompt,
            "model": model,
            "steps": steps,
            "seed": (int(seed) + int(v.variant_id) if seed is not None else None),
            "width": width,
            "height": height,
            "quantize": quantize,
            "guidance": guidance,
            "low_ram": bool(low_ram),
            "image_strength": image_strength,
        }

        if base_asset_id:
            payload["image_asset_id"] = base_asset_id
        else:
            payload["image_base64"] = base_image_base64

        payload = {k: v for (k, v) in payload.items() if v is not None}
        task_id = client.submit_generation(payload)
        variant_task_ids.append(task_id)
        variant_task_meta[task_id] = {"variant_id": v.variant_id, "slug": v.slug, "prompt": v_prompt}

    variant_done = client.wait_tasks_done(
        variant_task_ids,
        timeout_seconds=float(timeout_seconds),
        poll_interval_seconds=float(poll_interval_seconds),
    )

    variants_out: list[dict] = []
    variant_asset_ids: dict[int, str] = {}

    for task_id in variant_task_ids:
        task = variant_done.get(task_id) or {}
        if task.get("status") != "succeeded":
            raise RuntimeError(task.get("error") or "Variant task failed")
        asset_id = get_task_result_asset_id(task)
        blob, mime = client.download_asset(asset_id)
        ext = _guess_ext(mime, blob)
        meta = variant_task_meta.get(task_id) or {}
        variant_id = int(meta.get("variant_id") or 0)
        slug = str(meta.get("slug") or f"v{variant_id}")
        out_path = (out_dir / f"variant_{variant_id}_{slug}{ext}").resolve()
        out_path.write_bytes(blob)
        sha = _sha256_bytes(blob)

        variants_out.append(
            {
                "variant_id": variant_id,
                "slug": slug,
                "prompt": meta.get("prompt"),
                "task_id": task_id,
                "asset_id": asset_id,
                "path": _maybe_relative(out_path, settings.repo_root),
                "sha256": sha,
            }
        )
        variant_asset_ids[variant_id] = asset_id

    report("variants", 0.4)
    report("poses", 0.42)

    pose_task_ids: list[str] = []
    pose_task_meta: dict[str, dict] = {}

    for v in variant_specs:
        v_asset_id = variant_asset_ids.get(v.variant_id)
        if not v_asset_id:
            raise RuntimeError("Missing variant asset id")
        for p in pose_specs:
            p_prompt = _build_prompt(base_prompt, "same character", v.prompt, p.prompt)
            payload: dict = {
                "mode": "img2img",
                "prompt": p_prompt,
                "negative_prompt": negative_prompt,
                "model": model,
                "steps": steps,
                "seed": (
                    int(seed) + (int(v.variant_id) * 1000) + int(p.pose_id)
                    if seed is not None
                    else None
                ),
                "width": width,
                "height": height,
                "quantize": quantize,
                "guidance": guidance,
                "low_ram": bool(low_ram),
                "image_strength": image_strength,
                "image_asset_id": v_asset_id,
            }
            payload = {k: v for (k, v) in payload.items() if v is not None}
            task_id = client.submit_generation(payload)
            pose_task_ids.append(task_id)
            pose_task_meta[task_id] = {
                "variant_id": v.variant_id,
                "variant_slug": v.slug,
                "pose_id": p.pose_id,
                "pose_slug": p.slug,
                "prompt": p_prompt,
            }

    pose_done = client.wait_tasks_done(
        pose_task_ids,
        timeout_seconds=float(timeout_seconds),
        poll_interval_seconds=float(poll_interval_seconds),
    )

    poses_out: list[dict] = []

    for task_id in pose_task_ids:
        task = pose_done.get(task_id) or {}
        if task.get("status") != "succeeded":
            raise RuntimeError(task.get("error") or "Pose task failed")
        asset_id = get_task_result_asset_id(task)
        blob, mime = client.download_asset(asset_id)
        ext = _guess_ext(mime, blob)
        meta = pose_task_meta.get(task_id) or {}
        variant_id = int(meta.get("variant_id") or 0)
        pose_id = int(meta.get("pose_id") or 0)
        pose_slug = str(meta.get("pose_slug") or f"p{pose_id}")

        out_path = (out_dir / f"variant_{variant_id}_p_{pose_id}_{pose_slug}{ext}").resolve()
        out_path.write_bytes(blob)
        sha = _sha256_bytes(blob)

        poses_out.append(
            {
                "variant_id": variant_id,
                "pose_id": pose_id,
                "pose_slug": pose_slug,
                "prompt": meta.get("prompt"),
                "task_id": task_id,
                "asset_id": asset_id,
                "path": _maybe_relative(out_path, settings.repo_root),
                "sha256": sha,
            }
        )

    report("poses", 0.98)

    lineage = {
        "lineage_id": lineage_id,
        "avatar_name": name,
        "created_at": created_at,
        "upstream": {"base_url": settings.upstream_base_url, "model": model},
        "base": {
            "asset_id": base_asset_id,
            "path": _maybe_relative(base_path, settings.repo_root),
            "sha256": base_sha,
            "prompt": base_prompt,
        },
        "variants": variants_out,
        "poses": poses_out,
    }

    lineage_path = (out_dir / "lineage.json").resolve()
    lineage_path.write_text(json.dumps(lineage, indent=2, sort_keys=True) + "\n", encoding="utf-8")

    cards: list[dict] = []

    def add_image_card(*, card_id: str, name: str, path: str, prompt: Optional[str], source_id: Optional[str]) -> None:
        cards.append(
            {
                "id": card_id,
                "type": "standard",
                "mediaKind": "image",
                "createdAt": created_at,
                "name": name,
                "tags": [],
                "mediaPath": path,
                "provenance": {"model": model, "prompt": prompt, "sourceId": source_id},
            }
        )

    base_card_id = f"avatar_base_{base_sha}"
    add_image_card(
        card_id=base_card_id,
        name=f"{name} Base",
        path=_maybe_relative(base_path, settings.repo_root),
        prompt=base_prompt,
        source_id=None,
    )

    child_ids: list[str] = [base_card_id]

    for v in variants_out:
        cid = f"avatar_variant_{v.get('sha256')}"
        add_image_card(
            card_id=cid,
            name=f"{name} V{v.get('variant_id')}",
            path=str(v.get("path")),
            prompt=v.get("prompt"),
            source_id=base_card_id,
        )
        child_ids.append(cid)

    for p in poses_out:
        cid = f"avatar_pose_{p.get('sha256')}"
        add_image_card(
            card_id=cid,
            name=f"{name} V{p.get('variant_id')} P{p.get('pose_id')}",
            path=str(p.get("path")),
            prompt=p.get("prompt"),
            source_id=base_card_id,
        )
        child_ids.append(cid)

    set_card_id = f"avatar_lineage_set_{lineage_id}"
    set_card = {
        "id": set_card_id,
        "type": "set",
        "mediaKind": "image",
        "createdAt": created_at,
        "name": f"{name} Lineage",
        "children": child_ids,
        "thumbnail": _maybe_relative(base_path, settings.repo_root),
    }

    bundle = {
        "schema": "hapa_avatar_index_card_yaml_v1",
        "lineage_id": lineage_id,
        "avatar_name": name,
        "created_at": created_at,
        "set": set_card,
        "cards": cards,
    }

    card_yaml_path = (out_dir / "index.card.yaml").resolve()
    card_yaml_path.write_text(json.dumps(bundle, indent=2, sort_keys=True) + "\n", encoding="utf-8")

    report("complete", 1.0)

    return {
        "ok": True,
        "lineage_id": lineage_id,
        "avatar_name": name,
        "output_dir": _maybe_relative(out_dir, settings.repo_root),
        "lineage_path": _maybe_relative(lineage_path, settings.repo_root),
        "card_yaml_path": _maybe_relative(card_yaml_path, settings.repo_root),
        "counts": {
            "variants": len(variants_out),
            "poses": len(poses_out),
        },
        "base": lineage.get("base"),
    }
