#!/usr/bin/env python3
"""Backfill CLIP embeddings for every URL in kapruka_gift_product_image_urls.

The SQL migration must be applied before running this script. It is safe to
rerun: rows are upserted by (assigned_category, product_id, image_key), and
--skip-existing avoids downloading URLs already embedded with the selected model.
"""

from __future__ import annotations

import argparse
import hashlib
import io
import json
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass
from pathlib import Path
from typing import Any


SCRIPT_DIR = Path(__file__).resolve().parent
DEFAULT_ENV_FILE = SCRIPT_DIR.parent / "src" / ".env.local"
DEFAULT_CHECKPOINT = SCRIPT_DIR / ".kapruka_product_image_embeddings_checkpoint.json"
SOURCE_VIEW = "kapruka_gift_product_image_urls"
TARGET_TABLE = "kapruka_gift_product_image_embeddings"
DEFAULT_MODEL = "openai/clip-vit-base-patch32"


def read_env_file(path: Path) -> None:
    """Load simple KEY=VALUE lines without replacing already-exported values."""
    if not path.is_file():
        return
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        if key and key not in os.environ:
            os.environ[key] = value


@dataclass(frozen=True)
class SupabaseConfig:
    url: str
    secret_key: str

    @property
    def rest_url(self) -> str:
        return f"{self.url.rstrip('/')}/rest/v1"

    @property
    def headers(self) -> dict[str, str]:
        return {
            "apikey": self.secret_key,
            "Authorization": f"Bearer {self.secret_key}",
            "Content-Type": "application/json",
        }


def require_config() -> SupabaseConfig:
    url = os.environ.get("NEXT_PUBLIC_SUPABASE_URL") or os.environ.get("SUPABASE_URL")
    secret_key = os.environ.get("SUPABASE_SECRET_KEY") or os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not secret_key:
        raise RuntimeError(
            "Missing NEXT_PUBLIC_SUPABASE_URL (or SUPABASE_URL) and/or "
            "SUPABASE_SECRET_KEY (or SUPABASE_SERVICE_ROLE_KEY)."
        )
    return SupabaseConfig(url=url, secret_key=secret_key)


def http_json(request: urllib.request.Request, *, retries: int = 3) -> Any:
    for attempt in range(retries + 1):
        try:
            with urllib.request.urlopen(request, timeout=45) as response:
                body = response.read()
                return json.loads(body) if body else None
        except urllib.error.HTTPError as error:
            retryable = error.code == 429 or 500 <= error.code <= 599
            detail = error.read().decode("utf-8", errors="replace")
            if not retryable or attempt == retries:
                raise RuntimeError(f"Supabase returned HTTP {error.code}: {detail}") from error
        except (urllib.error.URLError, TimeoutError, OSError) as error:
            if attempt == retries:
                raise RuntimeError(f"Supabase request failed: {error}") from error
        time.sleep(min(20, 2**attempt))
    raise AssertionError("unreachable")


def supabase_get(config: SupabaseConfig, resource: str, params: dict[str, str]) -> Any:
    query = urllib.parse.urlencode(params, safe="(),.*")
    request = urllib.request.Request(
        f"{config.rest_url}/{resource}?{query}", headers=config.headers, method="GET"
    )
    return http_json(request)


def load_page(config: SupabaseConfig, offset: int, page_size: int) -> list[dict[str, Any]]:
    rows = supabase_get(
        config,
        SOURCE_VIEW,
        {
            "select": "assigned_category,product_id,image_url,image_position,is_primary,source_updated_at",
            "order": "assigned_category.asc,product_id.asc,image_position.asc",
            "limit": str(page_size),
            "offset": str(offset),
        },
    )
    if not isinstance(rows, list):
        raise RuntimeError("Unexpected response while reading the product-image URL view.")
    return rows


def existing_row(config: SupabaseConfig, row: dict[str, Any], image_key: str) -> dict[str, Any] | None:
    result = supabase_get(
        config,
        TARGET_TABLE,
        {
            "select": "image_hash,embedding_model",
            "assigned_category": f"eq.{row['assigned_category']}",
            "product_id": f"eq.{row['product_id']}",
            "image_key": f"eq.{image_key}",
            "limit": "1",
        },
    )
    return result[0] if isinstance(result, list) and result else None


def download_image(url: str) -> bytes:
    parsed = urllib.parse.urlparse(url)
    if parsed.scheme not in {"http", "https"}:
        raise ValueError("URL is not HTTP(S)")
    request = urllib.request.Request(url, headers={"User-Agent": "GenieAI-image-embedding-backfill/1.0"})
    with urllib.request.urlopen(request, timeout=40) as response:
        content_type = response.headers.get_content_type()
        if not content_type.startswith("image/") or content_type == "image/svg+xml":
            raise ValueError(f"unsupported image content type: {content_type}")
        data = response.read(12 * 1024 * 1024 + 1)
    if len(data) > 12 * 1024 * 1024:
        raise ValueError("image exceeds the 12 MB download limit")
    return data


class ClipEmbedder:
    def __init__(self, model_name: str) -> None:
        try:
            import torch
            from PIL import Image
            from transformers import CLIPModel, CLIPProcessor
        except ImportError as error:
            raise RuntimeError("Install dependencies first: python -m pip install torch transformers pillow") from error

        self.torch = torch
        self.Image = Image
        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        self.processor = CLIPProcessor.from_pretrained(model_name)
        self.model = CLIPModel.from_pretrained(model_name).to(self.device)
        self.model.eval()

    def embed(self, image_bytes: bytes) -> list[float]:
        with self.Image.open(io.BytesIO(image_bytes)) as image:
            image = image.convert("RGB")
            inputs = self.processor(images=image, return_tensors="pt")
        inputs = {key: value.to(self.device) for key, value in inputs.items()}
        with self.torch.inference_mode():
            vector = self.model.get_image_features(**inputs)
            # Transformers releases differ here: some return the tensor
            # directly, while newer releases return a model-output object.
            if hasattr(vector, "image_embeds"):
                vector = vector.image_embeds
            elif hasattr(vector, "pooler_output"):
                vector = vector.pooler_output
            elif isinstance(vector, tuple):
                vector = vector[0]
            vector = self.torch.nn.functional.normalize(vector, p=2, dim=1)
        values = vector[0].detach().cpu().tolist()
        if len(values) != 512:
            raise RuntimeError(f"Expected a 512-dimensional CLIP vector, got {len(values)}")
        return [float(value) for value in values]


def upsert(config: SupabaseConfig, record: dict[str, Any]) -> None:
    url = f"{config.rest_url}/{TARGET_TABLE}?on_conflict=assigned_category,product_id,image_key"
    headers = {**config.headers, "Prefer": "resolution=merge-duplicates,return=minimal"}
    request = urllib.request.Request(
        url, data=json.dumps(record, separators=(",", ":")).encode("utf-8"), headers=headers, method="POST"
    )
    http_json(request)


def vector_literal(values: list[float]) -> str:
    """pgvector's REST representation is its bracketed vector input literal."""
    return "[" + ",".join(format(value, ".9g") for value in values) + "]"


def load_checkpoint(path: Path, restart: bool) -> int:
    if restart or not path.is_file():
        return 0
    try:
        return max(0, int(json.loads(path.read_text(encoding="utf-8")).get("offset", 0)))
    except (ValueError, json.JSONDecodeError):
        return 0


def save_checkpoint(path: Path, offset: int) -> None:
    path.write_text(json.dumps({"offset": offset}) + "\n", encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--env-file", type=Path, default=DEFAULT_ENV_FILE)
    parser.add_argument("--checkpoint", type=Path, default=DEFAULT_CHECKPOINT)
    parser.add_argument("--page-size", type=int, default=50)
    parser.add_argument("--model", default=DEFAULT_MODEL)
    parser.add_argument("--dry-run", action="store_true", help="Download and validate images but do not write vectors.")
    parser.add_argument("--skip-existing", action="store_true", help="Skip a URL if it already has an embedding for this model.")
    parser.add_argument("--restart", action="store_true", help="Ignore the saved pagination checkpoint.")
    args = parser.parse_args()
    if not 1 <= args.page_size <= 1000:
        parser.error("--page-size must be between 1 and 1000")

    read_env_file(args.env_file)
    config = require_config()
    offset = load_checkpoint(args.checkpoint, args.restart)
    embedder: ClipEmbedder | None = None
    counts = {"embedded": 0, "skipped": 0, "failed": 0}

    while True:
        rows = load_page(config, offset, args.page_size)
        if not rows:
            break
        for row in rows:
            url = str(row["image_url"])
            image_key = hashlib.sha256(url.encode("utf-8")).hexdigest()
            try:
                existing = existing_row(config, row, image_key) if args.skip_existing else None
                if existing and existing.get("embedding_model") == args.model:
                    counts["skipped"] += 1
                    continue
                image_bytes = download_image(url)
                image_hash = hashlib.sha256(image_bytes).hexdigest()
                if existing and existing.get("image_hash") == image_hash and existing.get("embedding_model") == args.model:
                    counts["skipped"] += 1
                    continue
                if args.dry_run:
                    print(f"would embed {row['product_id']} {url}")
                    counts["embedded"] += 1
                    continue
                if embedder is None:
                    embedder = ClipEmbedder(args.model)
                embedding = embedder.embed(image_bytes)
                upsert(config, {
                    "assigned_category": row["assigned_category"],
                    "product_id": row["product_id"],
                    "image_key": image_key,
                    "image_url": url,
                    "image_position": row["image_position"],
                    "is_primary": row["is_primary"],
                    "image_hash": image_hash,
                    "embedding": vector_literal(embedding),
                    "embedding_model": args.model,
                    "source_updated_at": row.get("source_updated_at"),
                })
                counts["embedded"] += 1
                print(f"embedded {row['product_id']} image #{row['image_position']}")
            except (RuntimeError, ValueError, urllib.error.URLError, urllib.error.HTTPError, OSError) as error:
                counts["failed"] += 1
                print(f"skipped {row.get('product_id')} {url}: {error}", file=sys.stderr)

        offset += len(rows)
        save_checkpoint(args.checkpoint, offset)
        print(f"checkpoint {offset}; embedded={counts['embedded']} skipped={counts['skipped']} failed={counts['failed']}")
        if len(rows) < args.page_size:
            break

    print(f"done: embedded={counts['embedded']} skipped={counts['skipped']} failed={counts['failed']}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
