import struct
import zlib
import math
import os

def write_png(filename, width, height, pixels):
    def chunk(name, data):
        c = name + data
        return struct.pack(">I", len(data)) + c + struct.pack(">I", zlib.crc32(c) & 0xFFFFFFFF)

    ihdr = struct.pack(">IIBBBBB", width, height, 8, 2, 0, 0, 0)
    raw = b""
    for y in range(height):
        raw += b"\x00"
        for x in range(width):
            r, g, b, a = pixels[y][x]
            raw += bytes([r, g, b, a])

    # Re-encode as RGB with alpha by using RGBA color type (2 = RGB, 6 = RGBA)
    ihdr = struct.pack(">IIBBBBB", width, height, 8, 6, 0, 0, 0)
    compressed = zlib.compress(raw, 9)

    with open(filename, "wb") as f:
        f.write(b"\x89PNG\r\n\x1a\n")
        f.write(chunk(b"IHDR", ihdr))
        f.write(chunk(b"IDAT", compressed))
        f.write(chunk(b"IEND", b""))


def lerp(a, b, t):
    return a + (b - a) * t


def blend(bg, fg_color, alpha):
    r = int(lerp(bg[0], fg_color[0], alpha))
    g = int(lerp(bg[1], fg_color[1], alpha))
    b = int(lerp(bg[2], fg_color[2], alpha))
    a = min(255, bg[3] + int(alpha * (255 - bg[3])))
    return (r, g, b, a)


def make_icon(size):
    pixels = [[(0, 0, 0, 0)] * size for _ in range(size)]

    bg_r, bg_g, bg_b = 15, 15, 15   # #0F0F0F
    tri_r, tri_g, tri_b = 255, 32, 32  # #FF2020

    radius = size * 0.22  # corner radius as fraction of size
    cx, cy = size / 2, size / 2

    # Rounded rect signed distance
    def rounded_rect_dist(px, py):
        qx = abs(px - cx) - (size / 2 - radius)
        qy = abs(py - cy) - (size / 2 - radius)
        return (
            math.sqrt(max(qx, 0) ** 2 + max(qy, 0) ** 2)
            + min(max(qx, qy), 0)
            - radius
        )

    # Play triangle: centered, pointing right
    # Vertices relative to center
    scale = size * 0.28
    vx = [
        cx + scale * 0.7,          # right tip
        cx - scale * 0.55,         # top-left
        cx - scale * 0.55,         # bottom-left
    ]
    vy = [
        cy,                         # right tip
        cy - scale * 0.85,          # top-left
        cy + scale * 0.85,          # bottom-left
    ]

    # Shift triangle slightly right for optical balance
    offset_x = size * 0.03
    vx = [v + offset_x for v in vx]

    def point_in_triangle(px, py, ax, ay, bx, by, ccx, ccy):
        def sign(p1x, p1y, p2x, p2y, p3x, p3y):
            return (p1x - p3x) * (p2y - p3y) - (p2x - p3x) * (p1y - p3y)
        d1 = sign(px, py, ax, ay, bx, by)
        d2 = sign(px, py, bx, by, ccx, ccy)
        d3 = sign(px, py, ccx, ccy, ax, ay)
        has_neg = (d1 < 0) or (d2 < 0) or (d3 < 0)
        has_pos = (d1 > 0) or (d2 > 0) or (d3 > 0)
        return not (has_neg and has_pos)

    def triangle_sdf(px, py):
        # Signed distance to triangle (negative = inside)
        def edge_dist(ax, ay, bx, by, px, py):
            ex, ey = bx - ax, by - ay
            wx, wy = px - ax, py - ay
            t = max(0.0, min(1.0, (wx * ex + wy * ey) / (ex * ex + ey * ey)))
            dx, dy = wx - t * ex, wy - t * ey
            return math.sqrt(dx * dx + dy * dy)

        d = min(
            edge_dist(vx[0], vy[0], vx[1], vy[1], px, py),
            edge_dist(vx[1], vy[1], vx[2], vy[2], px, py),
            edge_dist(vx[2], vy[2], vx[0], vy[0], px, py),
        )
        inside = point_in_triangle(px, py, vx[0], vy[0], vx[1], vy[1], vx[2], vy[2])
        return -d if inside else d

    aa = 1.0  # anti-alias radius in pixels

    for y in range(size):
        for x in range(size):
            px, py = x + 0.5, y + 0.5

            # Background rounded rect coverage
            bg_d = rounded_rect_dist(px, py)
            bg_alpha = max(0.0, min(1.0, -bg_d / aa + 0.5))

            if bg_alpha <= 0:
                pixels[y][x] = (0, 0, 0, 0)
                continue

            # Background pixel
            pixel = (bg_r, bg_g, bg_b, int(bg_alpha * 255))

            # Triangle coverage
            tri_d = triangle_sdf(px, py)
            tri_alpha = max(0.0, min(1.0, -tri_d / aa + 0.5))

            if tri_alpha > 0:
                pixel = blend(pixel, (tri_r, tri_g, tri_b), tri_alpha * bg_alpha)

            pixels[y][x] = pixel

    return pixels


os.makedirs("icons", exist_ok=True)

for size, name in [(16, "icons/icon16.png"), (48, "icons/icon48.png"), (128, "icons/icon128.png")]:
    pixels = make_icon(size)
    write_png(name, size, size, pixels)
    print(f"Generated {name} ({size}x{size})")

print("Done.")
