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
            raw += bytes(pixels[y][x])

    ihdr = struct.pack(">IIBBBBB", width, height, 8, 6, 0, 0, 0)
    with open(filename, "wb") as f:
        f.write(b"\x89PNG\r\n\x1a\n")
        f.write(chunk(b"IHDR", ihdr))
        f.write(chunk(b"IDAT", zlib.compress(raw, 9)))
        f.write(chunk(b"IEND", b""))

# ── Helpers ───────────────────────────────────────────────────────────────────

def lerp(a, b, t):
    return a + (b - a) * t

def lerp3(c1, c2, t):
    return (lerp(c1[0], c2[0], t), lerp(c1[1], c2[1], t), lerp(c1[2], c2[2], t))

def sdf_alpha(d, aa=1.0):
    return max(0.0, min(1.0, -d / aa + 0.5))

def blend(pixel, color, alpha):
    return (
        int(lerp(pixel[0], color[0], alpha)),
        int(lerp(pixel[1], color[1], alpha)),
        int(lerp(pixel[2], color[2], alpha)),
        pixel[3],
    )

def circle_sdf(px, py, cx, cy, r):
    return math.sqrt((px - cx) ** 2 + (py - cy) ** 2) - r

def ring_sdf(px, py, cx, cy, r, thickness):
    return abs(circle_sdf(px, py, cx, cy, r)) - thickness / 2.0

def triangle_sdf(px, py, vx, vy):
    def edge_dist(ax, ay, bx, by):
        ex, ey = bx - ax, by - ay
        wx, wy = px - ax, py - ay
        t = max(0.0, min(1.0, (wx * ex + wy * ey) / (ex * ex + ey * ey)))
        return math.sqrt((wx - t * ex) ** 2 + (wy - t * ey) ** 2)

    def cross2(ax, ay, bx, by):
        return (px - bx) * (ay - by) - (ax - bx) * (py - by)

    d = min(
        edge_dist(vx[0], vy[0], vx[1], vy[1]),
        edge_dist(vx[1], vy[1], vx[2], vy[2]),
        edge_dist(vx[2], vy[2], vx[0], vy[0]),
    )
    signs = [cross2(vx[i], vy[i], vx[(i+1)%3], vy[(i+1)%3]) for i in range(3)]
    inside = not (any(s < 0 for s in signs) and any(s > 0 for s in signs))
    return -d if inside else d

# ── Icon design ───────────────────────────────────────────────────────────────
#
#  Shape     : circle (no corners) — modern app-icon aesthetic
#  Background: deep navy, radial gradient (slightly lighter core → dark rim)
#  Dial ring : thin annulus at ~85% radius; mostly dim slate, glows red
#              in a ~100° arc at the top-right (the "fast" dial position)
#  Triangle  : clean white, centered — no red competing with the dial accent
#
#  The dial ring reads instantly as a precision gauge. The glowing red arc is
#  the "needle position" — sophisticated and immediately communicates speed control.

def make_icon(size):
    pixels = [[(0, 0, 0, 0)] * size for _ in range(size)]

    cx, cy  = size / 2.0, size / 2.0
    icon_r  = size / 2.0 - 0.5
    aa      = 1.0

    # Colors
    BG_CORE  = (14, 15, 26)     # deep navy core
    BG_RIM   = (5,  5, 11)      # near-black rim
    WHITE    = (255, 255, 255)
    SLATE    = (160, 165, 190)   # cool gray for inactive ring
    RED      = (255,  50,  55)   # glowing red arc
    RED_GLOW = (255,  80,  80)   # softer for the halo

    # Dial ring geometry
    ring_r = icon_r * 0.82
    ring_t = max(1.2, size * 0.038)   # thickness scales with size

    # Red arc: top-right position (~10 o'clock to ~1 o'clock going through top)
    # Angles measured from +x axis, ccw (screen: y flipped, so atan2 uses -dy)
    ARC_START = math.radians(35)    # ~1 o'clock
    ARC_END   = math.radians(135)   # ~10 o'clock
    # (Arc sits in the upper portion, reading "fast" naturally)

    # Smooth arc blend: feather the transition over a few degrees
    FEATHER = math.radians(18)

    # Play triangle — white, clean, vertically centered, slightly right-shifted
    s   = size * 0.22
    tcx = cx + size * 0.04
    tcy = cy + size * 0.01
    vx  = [tcx + s * 0.82, tcx - s * 0.50, tcx - s * 0.50]
    vy  = [tcy,             tcy - s * 0.92,  tcy + s * 0.92]

    for y in range(size):
        for x in range(size):
            px, py = x + 0.5, y + 0.5

            # Circle boundary
            bd = circle_sdf(px, py, cx, cy, icon_r)
            ba = sdf_alpha(bd, aa)
            if ba <= 0:
                continue

            # Background: radial gradient (core lighter, rim darker)
            dist_n = math.sqrt((px - cx) ** 2 + (py - cy) ** 2) / icon_r
            bg = lerp3(BG_CORE, BG_RIM, min(1.0, dist_n ** 1.6))
            pixel = (int(bg[0]), int(bg[1]), int(bg[2]), int(ba * 255))

            # ── Dial ring ─────────────────────────────────────────────────────
            rd = ring_sdf(px, py, cx, cy, ring_r, ring_t)
            r_base = sdf_alpha(rd, aa)

            if r_base > 0:
                # Angle of this pixel relative to center (flip y for screen coords)
                angle = math.atan2(-(py - cy), px - cx)
                # Normalize to [0, 2π]
                if angle < 0:
                    angle += 2 * math.pi

                # Is this pixel in the red arc zone?
                in_arc = ARC_START <= angle <= ARC_END

                # Feathered blend between slate and red
                if in_arc:
                    edge_dist_angle = min(angle - ARC_START, ARC_END - angle)
                    arc_t = min(1.0, edge_dist_angle / FEATHER)
                    ring_color = lerp3(SLATE, RED, arc_t)
                    ring_opacity = lerp(0.18, 0.95, arc_t)
                else:
                    ring_color = SLATE
                    ring_opacity = 0.15

                ring_a = r_base * ring_opacity * ba
                if ring_a > 0:
                    pixel = blend(pixel, (int(ring_color[0]), int(ring_color[1]), int(ring_color[2])), ring_a)

                # Soft outer glow on the red arc section
                if in_arc:
                    glow_d = circle_sdf(px, py, cx, cy, ring_r)
                    glow_a = max(0.0, 1.0 - abs(glow_d) / (size * 0.12)) ** 2
                    glow_a *= 0.22 * ba
                    if glow_a > 0:
                        pixel = blend(pixel, RED_GLOW, glow_a)

            # ── Play triangle ─────────────────────────────────────────────────
            td = triangle_sdf(px, py, vx, vy)
            ta = sdf_alpha(td, aa) * ba
            if ta > 0:
                pixel = blend(pixel, WHITE, ta)

            pixels[y][x] = pixel

    return pixels

# ── Generate ──────────────────────────────────────────────────────────────────

os.makedirs("icons", exist_ok=True)

for size, path in [(16, "icons/icon16.png"), (48, "icons/icon48.png"), (128, "icons/icon128.png")]:
    write_png(path, size, size, make_icon(size))
    print(f"Generated {path} ({size}x{size})")

print("Done.")
