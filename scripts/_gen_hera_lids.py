"""
Build Hera's upper-lid sheet.

The portrait stays untouched. This PNG is only the lids: her real upper-lid
skin rows and lash pixels, extended just enough to cover the iris when slid down.
No iris, no brow, no circuit lines in the painted sheet.
"""
from __future__ import annotations

import math
import struct
import subprocess
import zlib
from pathlib import Path

ROOT = Path("/Users/thesynexus/SyNexus")
FACE_JPG = ROOT / "public/hera/hera-face.jpg"
FACE_BMP = Path("/tmp/hera-face.bmp")
OUT_PNG = ROOT / "public/hera/hera-lids.png"

# Socket centers. Top of each ellipse sits on the lash line.
# Slightly oversized so the soft edge still seals the iris.
EYES = [
    ("l", 218, 500, 52, 32),
    ("r", 468, 486, 54, 33),
]


def ensure_bmp() -> None:
    if FACE_BMP.exists() and FACE_BMP.stat().st_size > 1000:
        return
    subprocess.check_call(
        ["sips", "-s", "format", "bmp", str(FACE_JPG), "--out", str(FACE_BMP)],
        stdout=subprocess.DEVNULL,
    )


def load_bmp():
    data = FACE_BMP.read_bytes()
    off = struct.unpack_from("<I", data, 10)[0]
    w, h = struct.unpack_from("<ii", data, 18)
    bpp = struct.unpack_from("<H", data, 28)[0]
    assert bpp == 24
    W, H = w, abs(h)
    stride = ((24 * W + 31) // 32) * 4
    return data, off, W, H, h, stride


def pix(data, off, W, H, h, stride, x, y):
    if x < 0 or y < 0 or x >= W or y >= H:
        return (0, 0, 0)
    row = y if h < 0 else (H - 1 - y)
    i = off + row * stride + x * 3
    b, g, r = data[i], data[i + 1], data[i + 2]
    return r, g, b


def y_top(x, cx, cy, rx, ry):
    dx = (x - cx) / rx
    if abs(dx) >= 1:
        return None
    return cy - ry * math.sqrt(max(0.0, 1 - dx * dx))


def is_circuit(r, g, b):
    return g > 120 and g > r + 40


def is_iris(r, g, b):
    return g > 130 and g > r + 40 and r < 120


def lum(r, g, b):
    return 0.3 * r + 0.59 * g + 0.11 * b


def usable_skin(r, g, b):
    if is_iris(r, g, b) or is_circuit(r, g, b):
        return False
    return 16 <= lum(r, g, b) <= 150


def noise(x, y):
    v = (x * 374761393 + y * 668265263) & 0xFFFFFFFF
    v = (v ^ (v >> 13)) * 1274126177 & 0xFFFFFFFF
    return ((v ^ (v >> 16)) & 255) / 255.0


def chunk(tag, payload):
    return (
        struct.pack(">I", len(payload))
        + tag
        + payload
        + struct.pack(">I", zlib.crc32(tag + payload) & 0xFFFFFFFF)
    )


def write_png(path: Path, width: int, height: int, rgba: bytearray) -> None:
    raw = bytearray()
    for y in range(height):
        raw.append(0)
        raw.extend(rgba[y * width * 4 : (y + 1) * width * 4])
    png = b"\x89PNG\r\n\x1a\n"
    png += chunk(b"IHDR", struct.pack(">IIBBBBB", width, height, 8, 6, 0, 0, 0))
    png += chunk(b"IDAT", zlib.compress(bytes(raw), 9))
    png += chunk(b"IEND", b"")
    path.write_bytes(png)


def gather_band(get, x, yt, band=22):
    """Real upper-lid rows above the lash. Index 0 is closest to the lash."""
    rows = []
    for dist in range(1, band + 1):
        sy = int(yt) - dist
        r, g, b = get(x, sy)
        if usable_skin(r, g, b):
            rows.append((r, g, b))
        else:
            # keep slot with a neighbor if possible
            for dx in (-1, 1, -2, 2):
                rr, gg, bb = get(x + dx, sy)
                if usable_skin(rr, gg, bb):
                    rows.append((rr, gg, bb))
                    break
            else:
                rows.append(None)
    return rows


def fill_none(rows, fallback):
    out = []
    last = fallback
    for c in rows:
        if c is None:
            out.append(last)
        else:
            out.append(c)
            last = c
    return out


def main():
    ensure_bmp()
    data, off, W, H, h, stride = load_bmp()

    def get(x, y):
        return pix(data, off, W, H, h, stride, x, y)

    rgba = bytearray(W * H * 4)
    green_hits = 0

    for name, cx, cy, rx, ry in EYES:
        travel = 2 * ry + 6
        xs = list(range(int(cx - rx), int(cx + rx) + 1))

        # Per-column lid band from the photograph.
        bands = []
        for x in xs:
            yt = y_top(x, cx, cy, rx, ry)
            if yt is None:
                bands.append(None)
                continue
            bands.append(gather_band(get, x, yt))

        # Mean skin for fallbacks.
        samples = []
        for band in bands:
            if not band:
                continue
            for c in band:
                if c is not None:
                    samples.append(c)
        mean = (
            (
                sum(c[0] for c in samples) / len(samples),
                sum(c[1] for c in samples) / len(samples),
                sum(c[2] for c in samples) / len(samples),
            )
            if samples
            else (42, 92, 120)
        )

        filled_bands = []
        for band in bands:
            if band is None:
                filled_bands.append(None)
            else:
                filled_bands.append(fill_none(band, mean))

        for xi, x in enumerate(xs):
            yt = y_top(x, cx, cy, rx, ry)
            if yt is None or filled_bands[xi] is None:
                continue
            band = filled_bands[xi]
            band_len = max(1, len(band))

            lash = get(x, max(0, int(yt) - 1))
            lash2 = get(x, max(0, int(yt) - 2))
            if not usable_skin(*lash) or lum(*lash) > 100:
                lash = (8, 20, 32)
            if not usable_skin(*lash2) or lum(*lash2) > 105:
                lash2 = lash

            y0 = int(yt - travel) - 1
            y1 = int(math.ceil(yt)) + 1
            for y in range(y0, y1 + 1):
                if y < 0 or y >= H:
                    continue
                t = (yt - y) / travel  # 0 at lash, 1 at top of sheet
                if t < -0.05 or t > 1.06:
                    continue

                # Map sheet depth onto her real lid band, then repeat the upper rows.
                # Near the lash use band[0]; farther up cycle through the band.
                src_i = min(band_len - 1, int(t * (band_len + travel * 0.35)))
                # For the extended cover (beyond the real short lid), keep sampling
                # the upper half of the band so we don't invent new colors.
                if t > 0.55:
                    src_i = min(band_len - 1, band_len // 2 + int((t - 0.55) * (band_len // 2)))
                sr, sg, sb = band[src_i]

                # Soft horizontal blend with neighbors to kill stripes.
                for dx, wgt in ((-2, 0.12), (-1, 0.2), (1, 0.2), (2, 0.12)):
                    ni = xi + dx
                    if 0 <= ni < len(filled_bands) and filled_bands[ni]:
                        nr, ng, nb = filled_bands[ni][min(src_i, len(filled_bands[ni]) - 1)]
                        sr = sr * (1 - wgt) + nr * wgt
                        sg = sg * (1 - wgt) + ng * wgt
                        sb = sb * (1 - wgt) + nb * wgt

                # Pull toward mean so extreme dark crease rows don't read as holes.
                sr = sr * 0.72 + mean[0] * 0.28
                sg = sg * 0.72 + mean[1] * 0.28
                sb = sb * 0.72 + mean[2] * 0.28

                nse = noise(x, y) - 0.5
                shade = 0.94 + 0.12 * max(0.0, min(1.0, t))
                rr = sr * shade + nse * 2.5
                gg = sg * shade + nse * 2.5
                bb = sb * shade + nse * 3.0

                if 0.1 < t < 0.32:
                    k = 1 - abs(t - 0.18) / 0.14
                    rr *= 1 - 0.1 * k
                    gg *= 1 - 0.08 * k
                    bb *= 1 - 0.06 * k

                if t < 0.065:
                    mix = 0.92 if t < 0.025 else 0.55
                    lr, lg, lb = lash if t < 0.035 else lash2
                    rr = rr * (1 - mix) + lr * mix
                    gg = gg * (1 - mix) + lg * mix
                    bb = bb * (1 - mix) + lb * mix
                    if t < 0.018:
                        rr, gg, bb = rr * 0.5, gg * 0.5, bb * 0.55

                alpha = 255
                if t < 0:
                    alpha = int(255 * (1 + t / 0.05))
                if t > 0.97:
                    alpha = int(alpha * max(0.0, (1.06 - t) / 0.09))
                dx = abs(x - cx) / rx
                if dx > 0.92:
                    alpha = int(alpha * max(0.0, 1 - (dx - 0.92) / 0.1))
                alpha = max(0, min(255, alpha))
                if alpha < 5:
                    continue
                if gg > rr + 45 and gg > 140:
                    green_hits += 1
                    continue

                i = (y * W + x) * 4
                rgba[i] = max(0, min(255, int(rr)))
                rgba[i + 1] = max(0, min(255, int(gg)))
                rgba[i + 2] = max(0, min(255, int(bb)))
                rgba[i + 3] = alpha

        travel_pct = 100 * travel / H
        clip = (
            f"ellipse({100 * rx / W:.2f}% {100 * ry / H:.2f}% "
            f"at {100 * cx / W:.2f}% {100 * cy / H:.2f}%)"
        )
        print(name, clip, f'travel {travel_pct:.3f}%  data-travel="{travel_pct:.3f}"')

    write_png(OUT_PNG, W, H, rgba)
    print("png", OUT_PNG.stat().st_size, "green_hits", green_hits)

    def crop_composite(amount, x0, y0, cw, ch):
        buf = bytearray(cw * ch * 4)
        for y in range(ch):
            for x in range(cw):
                r, g, b = get(x0 + x, y0 + y)
                j = (y * cw + x) * 4
                buf[j : j + 4] = bytes((r, g, b, 255))
        for name, cx, cy, rx, ry in EYES:
            travel = 2 * ry + 6
            shift = travel * amount
            for y in range(ch):
                sy = y0 + y
                for x in range(cw):
                    sx = x0 + x
                    dx = (sx - cx) / rx
                    dy = (sy - cy) / ry
                    if dx * dx + dy * dy > 1:
                        continue
                    src_y = int(round(sy - shift))
                    if src_y < 0 or src_y >= H or sx < 0 or sx >= W:
                        continue
                    i = (src_y * W + sx) * 4
                    a = rgba[i + 3]
                    if a < 5:
                        continue
                    j = (y * cw + x) * 4
                    af = a / 255
                    buf[j] = int(rgba[i] * af + buf[j] * (1 - af))
                    buf[j + 1] = int(rgba[i + 1] * af + buf[j + 1] * (1 - af))
                    buf[j + 2] = int(rgba[i + 2] * af + buf[j + 2] * (1 - af))
        return buf

    write_png(Path("/tmp/qaL0.png"), 150, 110, crop_composite(0.0, 150, 450, 150, 110))
    write_png(Path("/tmp/qaL5.png"), 150, 110, crop_composite(0.5, 150, 450, 150, 110))
    write_png(Path("/tmp/qaL1.png"), 150, 110, crop_composite(1.0, 150, 450, 150, 110))
    write_png(Path("/tmp/qaR0.png"), 160, 120, crop_composite(0.0, 400, 430, 160, 120))
    write_png(Path("/tmp/qaR5.png"), 160, 120, crop_composite(0.5, 400, 430, 160, 120))
    write_png(Path("/tmp/qaR1.png"), 160, 120, crop_composite(1.0, 400, 430, 160, 120))
    print("crops done")


if __name__ == "__main__":
    main()