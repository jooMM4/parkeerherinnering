#!/usr/bin/env python3
"""Genereert icon-192.png en icon-512.png voor de Parkeerherinnering PWA."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

OUTPUT_DIR = Path(__file__).resolve().parent.parent / "icons"
BACKGROUND = (37, 99, 235)  # #2563eb
FOREGROUND = (255, 255, 255)


def draw_icon(size: int) -> Image.Image:
    img = Image.new("RGBA", (size, size), BACKGROUND)
    draw = ImageDraw.Draw(img)

    margin = size * 0.12
    draw.rounded_rectangle(
        [margin, margin, size - margin, size - margin],
        radius=size * 0.18,
        fill=BACKGROUND,
        outline=FOREGROUND,
        width=max(2, int(size * 0.02)),
    )

    try:
        font = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", int(size * 0.55))
    except OSError:
        font = ImageFont.load_default()

    text = "P"
    bbox = draw.textbbox((0, 0), text, font=font)
    text_w = bbox[2] - bbox[0]
    text_h = bbox[3] - bbox[1]
    position = ((size - text_w) / 2 - bbox[0], (size - text_h) / 2 - bbox[1])
    draw.text(position, text, fill=FOREGROUND, font=font)

    return img


def main():
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    for size in (192, 512):
        icon = draw_icon(size)
        path = OUTPUT_DIR / f"icon-{size}.png"
        icon.save(path, format="PNG")
        print(f"geschreven: {path}")


if __name__ == "__main__":
    main()
