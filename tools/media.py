#!/usr/bin/env python3
"""
Downloads and verifies every legitimate first-party image.

Each file is fetched, hashed, MIME-sniffed from its magic bytes, measured, and
scanned for embedded executable content before it is accepted into the build.
Nothing is ever executed.
"""
import csv, hashlib, json, os, re, struct, subprocess, sys, collections

SRC = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MIRROR = "/private/tmp/claude-501/-Users-sajjadahmad/3ed0644e-d346-4367-95c8-e402082c014f/scratchpad/dcs/live"
DEST = os.path.join(SRC, "site", "src", "assets", "img")
REP = os.path.join(SRC, "reports")
ORIGIN = "https://thediecutstickers.com"

# Executable/script signatures. Compressed image data contains arbitrary bytes,
# so short patterns matched anywhere in the file produce false positives. These
# are only meaningful in the header, in trailing bytes, or appended past the
# image terminator -- which is exactly where polyglot payloads live.
BAD = [b"<?php", b"<?=", b"<script", b"eval(", b"base64_decode", b"shell_exec",
       b"passthru", b"system(", b"gzinflate", b"str_rot13", b"#!/bin/", b"MZ\x90"]


def terminator_index(b: bytes, mime: str) -> int:
    """Offset just past the end of the real image stream, or -1 if unknown."""
    if mime == "image/jpeg":
        i = b.rfind(b"\xff\xd9")
        return i + 2 if i >= 0 else -1
    if mime == "image/png":
        i = b.rfind(b"IEND\xae\x42\x60\x82")
        return i + 8 if i >= 0 else -1
    if mime == "image/gif":
        return len(b) if b.endswith(b"\x3b") else -1
    if mime == "image/webp":
        try:
            return 8 + struct.unpack("<I", b[4:8])[0]
        except Exception:
            return -1
    return -1


def scan_payload(b: bytes, mime: str):
    """Return a list of concrete findings, or [] when the file is clean."""
    findings = []
    end = terminator_index(b, mime)
    if end != -1:
        trailing = b[end:]
        # A few padding bytes are normal; real appended payloads are larger.
        if len(trailing.strip(b"\x00\r\n \t")) > 16:
            findings.append(f"{len(trailing)} bytes appended after image terminator")
        regions = [b[:2048], trailing]
    else:
        findings.append("no valid image terminator")
        regions = [b[:2048], b[-2048:]]
    for region in regions:
        for sig in BAD:
            if sig in region:
                findings.append("signature " + sig.decode("latin1", "replace"))
    return findings

MAGIC = [
    (b"\xff\xd8\xff", "image/jpeg", "jpg"),
    (b"\x89PNG\r\n\x1a\n", "image/png", "png"),
    (b"GIF87a", "image/gif", "gif"),
    (b"GIF89a", "image/gif", "gif"),
    (b"RIFF", "image/webp", "webp"),
]


def sniff(b: bytes):
    for sig, mime, ext in MAGIC:
        if b.startswith(sig):
            if sig == b"RIFF" and b[8:12] != b"WEBP":
                continue
            return mime, ext
    if b.lstrip()[:5] in (b"<svg ", b"<?xml"):
        return "image/svg+xml", "svg"
    return "unknown", ""


def dims(b: bytes, mime: str):
    try:
        if mime == "image/png":
            return struct.unpack(">II", b[16:24])
        if mime == "image/gif":
            return struct.unpack("<HH", b[6:10])
        if mime == "image/webp":
            if b[12:16] == b"VP8X":
                w = int.from_bytes(b[24:27], "little") + 1
                h = int.from_bytes(b[27:30], "little") + 1
                return w, h
            if b[12:16] == b"VP8L":
                n = int.from_bytes(b[21:25], "little")
                return (n & 0x3FFF) + 1, ((n >> 14) & 0x3FFF) + 1
            if b[12:16] == b"VP8 ":
                i = b.find(b"\x9d\x01\x2a")
                if i > 0:
                    w, h = struct.unpack("<HH", b[i + 3:i + 7])
                    return w & 0x3FFF, h & 0x3FFF
        if mime == "image/jpeg":
            i = 2
            while i < len(b) - 9:
                if b[i] != 0xFF:
                    i += 1
                    continue
                m = b[i + 1]
                if m in (0xC0, 0xC1, 0xC2, 0xC3, 0xC5, 0xC6, 0xC7, 0xC9, 0xCA, 0xCB, 0xCD, 0xCE, 0xCF):
                    h, w = struct.unpack(">HH", b[i + 5:i + 9])
                    return w, h
                i += 2 + struct.unpack(">H", b[i + 2:i + 4])[0]
    except Exception:
        pass
    return 0, 0


def collect():
    """Every first-party upload referenced by the legitimate pages."""
    wanted = collections.OrderedDict()
    prods = json.load(open(os.path.join(SRC, "site", "src", "data", "products.json")))
    for p in prods:
        for i, u in enumerate(p["images"]):
            wanted.setdefault(u, []).append(f"product:{p['slug']}#{i}")
    for f in sorted(os.listdir(MIRROR)):
        s = open(os.path.join(MIRROR, f), encoding="utf-8", errors="replace").read()
        body = s[s.find("<body"):]
        for u in re.findall(r'(?:src|data-src)="(' + re.escape(ORIGIN) + r'/wp-content/uploads/[^"]+)"', body):
            base = re.sub(r"-\d+x\d+(?=\.\w+$)", "", u)
            wanted.setdefault(base, []).append("page:" + f.replace(".html", ""))
    for f in os.listdir(SRC):
        if f.startswith("elementor-") and f.endswith(".json"):
            for u in re.findall(r'https:[^"]*?wp-content[^"]*?\.(?:jpg|jpeg|png|webp|gif)',
                                open(os.path.join(SRC, f)).read(), re.I):
                wanted.setdefault(u.replace("\\/", "/"), []).append("elementor:" + f)
    return wanted


def main():
    os.makedirs(DEST, exist_ok=True)
    os.makedirs(REP, exist_ok=True)
    wanted = collect()
    print(f"candidate images: {len(wanted)}")

    seen_hash = {}
    rows = []
    excluded = []
    for url, refs in wanted.items():
        name = url.rsplit("/", 1)[-1]
        safe = re.sub(r"[^A-Za-z0-9._-]", "-", name)
        # reject double extensions / disguised executables up front
        if re.search(r"\.(php|phtml|phar|js|html?|svgz|sh|exe)(\.|$)", safe, re.I):
            excluded.append([url, "suspicious filename", "double or executable extension",
                             "excluded before download"])
            continue
        out = os.path.join(DEST, safe)
        if not os.path.exists(out):
            r = subprocess.run(["curl", "-sS", "-A", "Mozilla/5.0", "--max-time", "45",
                                "-o", out, "-w", "%{http_code}", url],
                               capture_output=True, text=True)
            if r.stdout.strip() != "200":
                if os.path.exists(out):
                    os.remove(out)
                excluded.append([url, "download failed", f"HTTP {r.stdout.strip()}", "missing on origin"])
                continue
        b = open(out, "rb").read()
        mime, ext = sniff(b)
        h = hashlib.sha256(b).hexdigest()
        w, ht = dims(b, mime)
        found = scan_payload(b, mime) if mime != "unknown" else []
        status = "clean"
        if mime == "unknown":
            status = "rejected: unrecognised format"
        elif found:
            status = "rejected: " + "; ".join(found)
        elif mime == "image/svg+xml":
            status = "rejected: SVG not accepted"
        if status != "clean":
            os.remove(out)
            excluded.append([url, "security scan", status, "excluded from build"])
            continue
        if not safe.lower().endswith("." + ext) and not (ext == "jpg" and safe.lower().endswith(".jpeg")):
            excluded.append([url, "extension mismatch", f"content is {mime}", "kept, served by content type"])
        dup = seen_hash.get(h)
        seen_hash.setdefault(h, safe)
        rows.append([url, "; ".join(sorted(set(refs))[:4]), name, mime, f"{w}x{ht}",
                     h[:16], "clean", "/src/assets/img/" + safe, "",
                     f"duplicate of {dup}" if dup else ("low resolution" if w and w < 400 else "")])

    with open(os.path.join(REP, "IMAGE_INVENTORY.csv"), "w", newline="") as f:
        wtr = csv.writer(f)
        wtr.writerow(["original_url", "referencing_page", "original_filename", "mime_type",
                      "dimensions", "file_hash_sha256_16", "security_status", "new_path",
                      "alt_text", "notes"])
        wtr.writerows(rows)
    with open(os.path.join(REP, "EXCLUDED_FILES_REPORT.csv"), "w", newline="") as f:
        wtr = csv.writer(f)
        wtr.writerow(["file_or_url", "detection_stage", "reason", "disposition"])
        wtr.writerows(excluded)
    dups = sum(1 for r in rows if r[9].startswith("duplicate"))
    print(f"accepted={len(rows)} excluded={len(excluded)} duplicates={dups}")


if __name__ == "__main__":
    main()
