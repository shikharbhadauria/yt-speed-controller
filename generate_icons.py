import struct
import zlib
import math
import os

# ── PNG writer ────────────────────────────────────────────────────────────────

def write_png(filename, width, height, pixels):
    def chunk(name, data):
        c = name + data
        return struct.pack(">I", len(data)) + c + struct.pack(">I", zlib.crc32(c) & 0xFFFFFFFF)

    raw = b""
    for y in range(height):
        raw += b"\x00"
        for x in range(width):
            r, g, b, a = pixels[y][x]
            raw += bytes([r, g, b, a])

    ihdr = struct.pack(">IIBBBBB", width, height, 8, 6, 0, 0, 0)
    compressed = zlib.compress(raw, 9)

    with open(filename, "wb") as f:
        f.write(b"\x89PNG\r\n\x1a\n")
        f.write(chunk(b"IHDR", ihdr))
        f.write(chunk(b"IDAT", compressed))
        f.write(chunk(b"IEND", b""))

# ── SDF helpers ───────────────────────────────────────────────────────────────

def rounded_rect_sdf(px, py, cx, cy, size, radius):
    qx = abs(px - cx) - (size / 2.0 - radius)
    qy = abs(py - cy) - (size / 2.0 - radius)
    return math.sqrt(max(qx, 0) ** 2 + max(qy, 0) ** 2) + min(max(qx, qy), 0) - radius

def capsule_sdf(px, py, x1, x2, yc, r):
    """Horizontal capsule (pill shape) signed distance."""
    cx_seg = max(x1 + r, min(x2 - r, px))
    dx, dy = px - cx_seg, py - yc
    return math.sqrt(dx * dx + dy * dy) - r

def triangle_sdf(px, py, vx, vy):
    def edge_dist(ax, ay, bx, by):
        ex, ey = bx - ax, by - ay
        wx, wy = px - ax, py - ay
        t = max(0.0, min(1.0, (wx * ex + wy * ey) / (ex * ex + ey * ey)))
        dx, dy = wx - t * ex, wy - t * ey
        return math.sqrt(dx * dx + dy * dy)

    def sign(ax, ay, bx, by):
        return (px - bx) * (ay - by) - (ax - bx) * (py - by)

    d = min(
        edge_dist(vx[0], vy[0], vx[1], vy[1]),
        edge_dist(vx[1], vy[1], vx[2], vy[2]),
        edge_dist(vx[2], vy[2], vx[0], vy[0]),
    )
    d1 = sign(vx[0], vy[0], vx[1], vy[1])
    d2 = sign(vx[1], vy[1], vx[2], vy[2])
    d3 = sign(vx[2], vy[2], vx[0], vy[0])
    has_neg = (d1 < 0) or (d2 < 0) or (d3 < 0)
    has_pos = (d1 > 0) or (d2 > 0) or (d3 > 0)
    inside = not (has_neg and has_pos)
    return -d if inside else d

def sdf_to_alpha(d, aa=1.0):
    return max(0.0, min(1.0, -d / aa + 0.5))

def blend(pixel, color, alpha):
    r = int(pixel[0] * (1 - alpha) + color[0] * alpha)
    g = int(pixel[1] * (1 - alpha) + color[1] * alpha)
    b = int(pixel[2] * (1 - alpha) + color[2] * alpha)
    return (r, g, b, pixel[3])

# ── Icon design ───────────────────────────────────────────────────────────────
#
#  Dark rounded square background
#  Three horizontal speed-streak lines (white, fading left → right) on the left
#  Bold red play triangle on the right
#  Together they read as "fast playback / motion"

def make_icon(size):
    pixels = [[(0, 0, 0, 0)] * size for _ in range(size)]

    BG    = (15, 15, 15)        # #0F0F0F
    RED   = (255, 45, 45)       # play triangle
    WHITE = (255, 255, 255)     # speed streaks

    cx, cy = size / 2.0, size / 2.0
    radius = size * 0.21
    aa = 1.0

    # ── Play triangle — shifted right of center ───────────────────────────────
    s = size * 0.27                       # scale factor
    tx = cx + size * 0.11                 # horizontal anchor (right of center)
    vx = [tx + s * 0.75, tx - s * 0.52, tx - s * 0.52]
    vy = [cy,             cy - s * 0.88,  cy + s * 0.88]

    # ── Speed streaks — three horizontal capsules, left of triangle ───────────
    # (x_start, x_end, y_offset_from_cy, half_height, opacity)
    gap   = size * 0.145
    lx0   = size * 0.09                   # left edge of lines
    lx1_s = tx - s * 0.65                 # right edge — just touches triangle left edge
    lh    = size * 0.065                  # capsule radius

    streaks = [
        (lx0, lx1_s * 0.84, cy - gap, lh, 0.40),   # top    — shorter, dimmer
        (lx0, lx1_s,         cy,       lh, 0.65),   # middle — longest, brightest
        (lx0, lx1_s * 0.84, cy + gap, lh, 0.40),   # bottom — shorter, dimmer
    ]

    for y in range(size):
        for x in range(size):
            px, py = x + 0.5, y + 0.5

            bg_d = rounded_rect_sdf(px, py, cx, cy, size, radius)
            bg_a = sdf_to_alpha(bg_d, aa)
            if bg_a <= 0:
                continue

            pixel = (BG[0], BG[1], BG[2], int(bg_a * 255))

            # Speed streaks (behind triangle)
            for x1, x2, yc, r, opacity in streaks:
                d = capsule_sdf(px, py, x1, x2, yc, r)
                a = sdf_to_alpha(d, aa) * opacity * bg_a
                if a > 0:
                    pixel = blend(pixel, WHITE, a)

            # Play triangle (on top)
            td = triangle_sdf(px, py, vx, vy)
            ta = sdf_to_alpha(td, aa) * bg_a
            if ta > 0:
                pixel = blend(pixel, RED, ta)

            pixels[y][x] = pixel

    return pixels

# ── Generate ──────────────────────────────────────────────────────────────────

os.makedirs("icons", exist_ok=True)

for size, path in [(16, "icons/icon16.png"), (48, "icons/icon48.png"), (128, "icons/icon128.png")]:
    write_png(path, size, size, make_icon(size))
    print(f"Generated {path} ({size}x{size})")

print("Done.")
