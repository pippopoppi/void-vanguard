#!/usr/bin/env python3
"""Render og.png (1200x630 Twitter/OpenGraph card) and icon-180.png with Pillow."""
import math
import os
import random

from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
random.seed(11)


def font(size, bold=True):
    for c in ["/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf" if bold else "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
              "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf"]:
        if os.path.exists(c):
            return ImageFont.truetype(c, size)
    return ImageFont.load_default()


def ship(d, x, y, s, col="#38bdf8", dark="#0369a1"):
    # pointing right
    d.polygon([(x + 36 * s, y), (x - 8 * s, y - 12 * s), (x - 20 * s, y - 12 * s), (x - 20 * s, y + 12 * s), (x - 8 * s, y + 12 * s)], fill=col)
    d.polygon([(x - 20 * s, y - 12 * s), (x - 4 * s, y - 12 * s), (x - 18 * s, y - 32 * s)], fill=dark)
    d.polygon([(x - 20 * s, y + 12 * s), (x - 4 * s, y + 12 * s), (x - 18 * s, y + 32 * s)], fill=dark)
    d.ellipse((x - 2 * s, y - 5 * s, x + 12 * s, y + 5 * s), fill="#e0f2fe")
    d.polygon([(x - 20 * s, y - 8 * s), (x - 20 * s, y + 8 * s), (x - 44 * s, y)], fill="#fde047")
    d.polygon([(x - 20 * s, y - 4 * s), (x - 20 * s, y + 4 * s), (x - 34 * s, y)], fill="#fb923c")


def drone(d, x, y, s):
    d.ellipse((x - 14 * s, y - 6 * s, x + 14 * s, y + 6 * s), fill="#9d174d")
    d.ellipse((x - 9 * s, y - 12 * s, x + 9 * s, y + 4 * s), fill="#f472b6")
    d.ellipse((x - 3 * s, y - 8 * s, x + 3 * s, y - 2 * s), fill="#fff")


def fighter(d, x, y, s):
    d.polygon([(x - 2 * s, y - 16 * s), (x + 10 * s, y), (x - 2 * s, y + 16 * s), (x - 10 * s, y + 10 * s), (x - 10 * s, y - 10 * s)], fill="#9a3412")
    d.polygon([(x - 16 * s, y), (x + 8 * s, y - 7 * s), (x + 12 * s, y), (x + 8 * s, y + 7 * s)], fill="#fb923c")


def tank(d, x, y, s):
    pts = [(x + math.cos(i / 6 * math.tau) * 20 * s, y + math.sin(i / 6 * math.tau) * 20 * s) for i in range(6)]
    d.polygon(pts, fill="#5b21b6")
    pts = [(x + math.cos(i / 6 * math.tau) * 14 * s, y + math.sin(i / 6 * math.tau) * 14 * s) for i in range(6)]
    d.polygon(pts, fill="#a78bfa")
    d.ellipse((x - 5 * s, y - 5 * s, x + 5 * s, y + 5 * s), fill="#1e1b4b")


def boss(d, x, y, s):
    d.ellipse((x - 70 * s, y - 70 * s, x + 70 * s, y + 70 * s), fill=(124, 58, 237, 60))
    d.polygon([(x + 10, y - 70 * s), (x + 30 * s, y - 30 * s), (x + 30 * s, y + 30 * s), (x + 10, y + 70 * s), (x - 30 * s, y + 50 * s), (x - 30 * s, y - 50 * s)], fill="#3b0764")
    d.polygon([(x + 24 * s, y - 40 * s), (x + 24 * s, y + 40 * s), (x - 10 * s, y + 52 * s), (x - 34 * s, y + 20 * s), (x - 34 * s, y - 20 * s), (x - 10 * s, y - 52 * s)], fill="#7c3aed")
    d.ellipse((x - 18 * s, y - 14 * s, x + 10 * s, y + 14 * s), fill="#22d3ee")
    d.ellipse((x - 12 * s, y - 8 * s, x - 4 * s, y), fill="#fff")


def card():
    W, H = 1200, 630
    img = Image.new("RGB", (W, H), "#0b1026")
    d = ImageDraw.Draw(img, "RGBA")
    d.ellipse((700, 50, 1150, 400), fill=(124, 58, 237, 40))
    d.ellipse((-100, 300, 400, 650), fill=(14, 165, 233, 35))
    for i in range(260):
        x, y = random.randint(0, W), random.randint(0, H)
        z = random.random()
        d.rectangle((x, y, x + (2 if z > 0.8 else 1), y + 1 + z * 10), fill=(255, 255, 255, int(90 + z * 160)))
    ship(d, 230, 320, 2.4)
    for k in range(7):
        d.ellipse((330 + k * 55, 314, 352 + k * 55, 326), fill="#fef08a")
    for k in range(6):
        drone(d, 760 + (k % 3) * 90, 150 + (k // 3) * 70 + (k % 3) * 20, 1.5)
    for k in range(4):
        fighter(d, 700 + k * 80, 440 + (k % 2) * 60, 1.5)
    tank(d, 640, 240, 1.6)
    boss(d, 1010, 330, 1.5)
    banner = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    bd = ImageDraw.Draw(banner)
    bd.rounded_rectangle((40, 450, 720, 596), 26, fill=(5, 8, 26, 220))
    img.paste(banner, (0, 0), banner)
    d = ImageDraw.Draw(img, "RGBA")
    d.text((70, 462), "VOID VANGUARD", font=font(72), fill="#7dd3fc")
    d.text((72, 548), "Drag to fly. Blast the waves. Bring down the Dreadnought.", font=font(25, bold=False), fill="#e2e8f0")
    img.save(os.path.join(ROOT, "og.png"), optimize=True)
    print("wrote og.png")


def icon():
    S = 180
    img = Image.new("RGB", (S, S), "#0b1026")
    d = ImageDraw.Draw(img, "RGBA")
    for i in range(40):
        x, y = random.randint(0, S), random.randint(0, S)
        d.rectangle((x, y, x + 1, y + 3), fill=(255, 255, 255, 180))
    d.polygon([(90, 24), (118, 110), (118, 140), (62, 140), (62, 110)], fill="#38bdf8")
    d.polygon([(24, 134), (62, 94), (62, 140)], fill="#0369a1")
    d.polygon([(156, 134), (118, 94), (118, 140)], fill="#0369a1")
    d.ellipse((80, 70, 100, 110), fill="#e0f2fe")
    d.polygon([(72, 140), (108, 140), (90, 172)], fill="#fde047")
    img.save(os.path.join(ROOT, "icon-180.png"), optimize=True)
    print("wrote icon-180.png")


if __name__ == "__main__":
    card()
    icon()
