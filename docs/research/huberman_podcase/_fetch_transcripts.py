"""Fetch YouTube transcripts for a set of Huberman podcast videos and save as Markdown.

Usage:
    python3 _fetch_transcripts.py
"""

from __future__ import annotations

import json
import re
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path

from youtube_transcript_api import YouTubeTranscriptApi
from youtube_transcript_api._errors import (
    NoTranscriptFound,
    TranscriptsDisabled,
    VideoUnavailable,
)


# (playlist_index, video_id)
VIDEOS: list[tuple[int, str]] = [
    (1, "Pmd6knanPKw"),
    (3, "bdsc3Spm6Sw"),
    (4, "Wcs2PFz5q6g"),
    (5, "QmOF0crdyRU"),
    (6, "K4Ze-Sp6aUE"),
    (7, "hFL6qRIJZ_Y"),
    (8, "xjEFo3a1AnI"),
    (9, "q37ARYnRDGc"),
    (10, "_ltcLEM-5HU"),
    (11, "nm1TxQj9IsQ"),
    (12, "s95KFJ2efm4"),
    (13, "hnzrPKvRBD8"),
]

OUT_DIR = Path(__file__).parent


def slugify(text: str) -> str:
    text = text.lower()
    text = re.sub(r"[^a-z0-9]+", "-", text)
    text = re.sub(r"-+", "-", text).strip("-")
    return text[:80] or "video"


def fetch_title(video_id: str) -> str | None:
    url = (
        "https://www.youtube.com/oembed?url="
        + urllib.parse.quote(f"https://www.youtube.com/watch?v={video_id}", safe="")
        + "&format=json"
    )
    try:
        with urllib.request.urlopen(url, timeout=20) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            return data.get("title")
    except Exception as exc:  # noqa: BLE001
        print(f"  ! Could not fetch title for {video_id}: {exc}", file=sys.stderr)
        return None


def format_timestamp(seconds: float) -> str:
    s = int(seconds)
    h, rem = divmod(s, 3600)
    m, s = divmod(rem, 60)
    if h:
        return f"[{h:02d}:{m:02d}:{s:02d}]"
    return f"[{m:02d}:{s:02d}]"


def fetch_transcript(video_id: str):
    api = YouTubeTranscriptApi()
    transcript_list = api.list(video_id)
    try:
        transcript = transcript_list.find_manually_created_transcript(["en", "en-US", "en-GB"])
        kind = "manual"
    except NoTranscriptFound:
        try:
            transcript = transcript_list.find_generated_transcript(["en", "en-US", "en-GB"])
            kind = "auto-generated"
        except NoTranscriptFound:
            transcript = next(iter(transcript_list))
            kind = f"fallback-{transcript.language_code}"
    fetched = transcript.fetch()
    return fetched, kind, transcript.language_code


def write_markdown(idx: int, video_id: str, title: str | None, fetched, kind: str, lang: str) -> Path:
    safe_title = slugify(title) if title else f"video-{video_id}"
    filename = f"{idx:02d}-{safe_title}-{video_id}.md"
    out_path = OUT_DIR / filename

    header_title = title or video_id
    lines = [
        f"# {header_title}",
        "",
        f"- Video ID: `{video_id}`",
        f"- URL: https://www.youtube.com/watch?v={video_id}",
        f"- Playlist index: {idx}",
        f"- Transcript: {kind} ({lang})",
        "",
        "## Transcript",
        "",
    ]

    snippets = list(fetched)
    for snip in snippets:
        ts = format_timestamp(snip.start)
        text = snip.text.replace("\n", " ").strip()
        if not text:
            continue
        lines.append(f"{ts} {text}")

    out_path.write_text("\n".join(lines) + "\n", encoding="utf-8")
    return out_path


def main() -> int:
    failures: list[tuple[int, str, str]] = []
    successes: list[tuple[int, str, Path]] = []

    for idx, video_id in VIDEOS:
        print(f"[{idx:02d}] {video_id} ...", flush=True)
        try:
            title = fetch_title(video_id)
            fetched, kind, lang = fetch_transcript(video_id)
            out_path = write_markdown(idx, video_id, title, fetched, kind, lang)
            successes.append((idx, video_id, out_path))
            print(f"     -> saved {out_path.name} ({kind}/{lang})")
        except (TranscriptsDisabled, NoTranscriptFound, VideoUnavailable) as exc:
            failures.append((idx, video_id, type(exc).__name__))
            print(f"     ! {type(exc).__name__}: {exc}", file=sys.stderr)
        except Exception as exc:  # noqa: BLE001
            failures.append((idx, video_id, f"{type(exc).__name__}: {exc}"))
            print(f"     ! {type(exc).__name__}: {exc}", file=sys.stderr)
        time.sleep(1.2)

    print("\nSummary:")
    print(f"  Saved   : {len(successes)}")
    print(f"  Failed  : {len(failures)}")
    for idx, vid, err in failures:
        print(f"   - [{idx:02d}] {vid}: {err}")

    return 0 if not failures else 1


if __name__ == "__main__":
    sys.exit(main())
