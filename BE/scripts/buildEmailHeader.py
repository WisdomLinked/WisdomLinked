"""Trim the WisdomLinked banner down to the logo and write the email header asset.

Usage:
    python3 scripts/buildEmailHeader.py <source.png> [--out ../FE/public/email-header.png]

The source is the navy banner with the white WisdomLinked lockup. Most of it is
empty navy, so pasting it straight into an email leaves a huge block above every
message. This crops to the artwork, adds even breathing room, and writes a
retina-width PNG on the same navy so it blends with the header band.
"""

import argparse
import os
import sys

from PIL import Image

TARGET_WIDTH = 440
MAX_HEIGHT = 150
PAD_RATIO = 0.16


def trim_to_artwork(img, background):
    rgb = img.convert("RGB")
    width, height = rgb.size
    pixels = rgb.load()

    def differs(x, y):
        r, g, b = pixels[x, y]
        br, bg, bb = background
        return abs(r - br) + abs(g - bg) + abs(b - bb) > 40

    left, right, top, bottom = width, -1, height, -1
    for y in range(height):
        for x in range(width):
            if differs(x, y):
                left = min(left, x)
                right = max(right, x)
                top = min(top, y)
                bottom = max(bottom, y)

    if right < 0:
        raise SystemExit("No artwork found — the image looks like a solid block of colour.")
    return rgb.crop((left, top, right + 1, bottom + 1))


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("source")
    parser.add_argument(
        "--out",
        default=os.path.join(os.path.dirname(__file__), "..", "assets", "email-header.png"),
    )
    args = parser.parse_args()

    if not os.path.exists(args.source):
        raise SystemExit(f"Source image not found: {args.source}")

    img = Image.open(args.source)
    background = img.convert("RGB").getpixel((0, 0))

    art = trim_to_artwork(img, background)
    pad = int(art.height * PAD_RATIO)
    canvas = Image.new("RGB", (art.width + pad * 2, art.height + pad * 2), background)
    canvas.paste(art, (pad, pad))

    scale = min((TARGET_WIDTH * 2) / canvas.width, (MAX_HEIGHT * 2) / canvas.height)
    final = canvas.resize(
        (max(1, round(canvas.width * scale)), max(1, round(canvas.height * scale))),
        Image.LANCZOS,
    )

    out = os.path.abspath(args.out)
    os.makedirs(os.path.dirname(out), exist_ok=True)
    # A logo is a handful of flat colours, so a palette costs nothing visually and
    # roughly halves a file that rides along in every email we send.
    final.convert("P", palette=Image.ADAPTIVE, colors=64).save(out, "PNG", optimize=True)

    size_kb = os.path.getsize(out) / 1024
    print(f"background navy : #{background[0]:02X}{background[1]:02X}{background[2]:02X}")
    print(f"wrote           : {out} ({final.width}x{final.height}, {size_kb:.0f} KB)")
    print(f"displays at     : {final.width // 2}x{final.height // 2} in the email")
    print("This must live inside BE/ — the Docker build context is ./BE.")
    if size_kb > 60:
        print("WARNING: over 60 KB. It is embedded in every email — consider a tighter crop.")
    print("If the navy above does not match BRAND.banner in services/emailTemplate.ts, update it there.")


if __name__ == "__main__":
    sys.exit(main())
