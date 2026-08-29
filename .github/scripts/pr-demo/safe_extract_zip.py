#!/usr/bin/env python3

import json
import shutil
import stat
import sys
import zipfile
from pathlib import Path

MIB = 1024 * 1024
FILE_LIMITS = {
    "decision.json": 1 * MIB,
    "manifest.json": 1 * MIB,
    "desktop.gif": 8 * MIB,
    "desktop.mp4": 12 * MIB,
    "mobile.gif": 8 * MIB,
    "mobile.mp4": 12 * MIB,
}
MAX_FILES = len(FILE_LIMITS)
MAX_TOTAL_BYTES = sum(FILE_LIMITS.values())
MAX_COMPRESSION_RATIO = 100
CHUNK_BYTES = 64 * 1024


def validate_entries(archive: zipfile.ZipFile) -> list[zipfile.ZipInfo]:
    entries = archive.infolist()
    if not 1 <= len(entries) <= MAX_FILES:
        raise ValueError("artifact ZIPのentry数が不正です")

    names = [entry.filename for entry in entries]
    if len(names) != len(set(names)):
        raise ValueError("artifact ZIPに重複entryがあります")
    if "decision.json" not in names:
        raise ValueError("artifact ZIPにdecision.jsonがありません")

    total_bytes = 0
    for entry in entries:
        if entry.filename not in FILE_LIMITS or entry.is_dir():
            raise ValueError(f"artifact ZIPに未許可entryがあります: {entry.filename}")
        if entry.flag_bits & 0x1:
            raise ValueError(f"暗号化されたentryは許可しません: {entry.filename}")
        if entry.compress_type not in (zipfile.ZIP_STORED, zipfile.ZIP_DEFLATED):
            raise ValueError(f"未対応の圧縮方式です: {entry.filename}")

        unix_mode = (entry.external_attr >> 16) & 0xFFFF
        file_type = stat.S_IFMT(unix_mode)
        if file_type == stat.S_IFLNK:
            raise ValueError(f"symlink entryは許可しません: {entry.filename}")
        if file_type not in (0, stat.S_IFREG):
            raise ValueError(f"通常file以外のentryは許可しません: {entry.filename}")

        limit = FILE_LIMITS[entry.filename]
        if entry.file_size <= 0 or entry.file_size > limit:
            raise ValueError(f"{entry.filename}が許可sizeを超えています")
        if entry.compress_size <= 0:
            raise ValueError(f"{entry.filename}の圧縮sizeが不正です")
        if entry.file_size / entry.compress_size > MAX_COMPRESSION_RATIO:
            raise ValueError(f"{entry.filename}の圧縮率が高すぎます")
        total_bytes += entry.file_size

    if total_bytes > MAX_TOTAL_BYTES:
        raise ValueError("artifact ZIPの展開後合計sizeが大きすぎます")
    return entries


def safe_extract(archive_path: Path, destination: Path) -> list[str]:
    if destination.exists():
        raise ValueError("artifact展開先は存在しないdirectoryである必要があります")

    created = False
    try:
        with zipfile.ZipFile(archive_path, "r") as archive:
            entries = validate_entries(archive)
            destination.mkdir(parents=True, mode=0o700)
            created = True
            for entry in entries:
                target = destination / entry.filename
                written = 0
                with archive.open(entry, "r") as source, target.open("xb") as output:
                    while True:
                        chunk = source.read(CHUNK_BYTES)
                        if not chunk:
                            break
                        written += len(chunk)
                        if written > FILE_LIMITS[entry.filename]:
                            raise ValueError(f"{entry.filename}が展開中に許可sizeを超えました")
                        output.write(chunk)
                if written != entry.file_size:
                    raise ValueError(f"{entry.filename}の展開sizeがcentral directoryと一致しません")
                target.chmod(0o600)
            return sorted(entry.filename for entry in entries)
    except Exception:
        if created:
            shutil.rmtree(destination)
        raise


def main() -> None:
    if len(sys.argv) != 3:
        raise ValueError("archive pathとdestinationが必要です")
    archive_path = Path(sys.argv[1]).resolve(strict=True)
    destination = Path(sys.argv[2]).resolve(strict=False)
    print(json.dumps({"entries": safe_extract(archive_path, destination)}))


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print(f"safe extraction failed: {error}", file=sys.stderr)
        raise SystemExit(1)
