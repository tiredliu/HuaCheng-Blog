#!/usr/bin/env python3
"""生成「图片与封面」测试文章用的示例配图。

只服务于 `content/posts/image-cover-demo.mdx` 与 `image-thumbnails-demo.mdx`
这两篇自检文章 —— 它们是用来验收「正文配图 / 列表页缩略图带 / 卡片背景封面图」的。

想清掉这些示例资源，把下面三样一起删掉即可：

    public/images/demo-*.jpg
    content/posts/image-cover-demo.mdx
    content/posts/image-thumbnails-demo.mdx
    scripts/make-demo-images.py

重新生成：

    python scripts/make-demo-images.py

刻意用**图形 + 文字**而不是真实照片：验收时要能一眼认出
「卡片背景用的到底是哪一张」「缩略图带里出现的是第几张」，
所以每张图都有编号和明显的色块。
"""

from __future__ import annotations

import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

# 输出目录：仓库根的 public/images（文章配图与封面都放这里，见 src/lib/assets.ts）
ROOT = Path(__file__).resolve().parent.parent
OUT_DIR = ROOT / "public" / "images"

# 站点调色板：木棉红 / 岭南青是博客的主题色，其余为配套的冷暖色
PALETTE = [
    ((0xE4, 0x51, 0x3A), (0xFF, 0xC2, 0xB0), "木棉红"),
    ((0x17, 0x94, 0x7E), (0xA7, 0xE8, 0xD8), "岭南青"),
    ((0x1D, 0x4E, 0xD8), (0xC3, 0xDC, 0xFE), "珠江蓝"),
    ((0x7C, 0x3A, 0xED), (0xE0, 0xD9, 0xFE), "暮色紫"),
    ((0xEA, 0x58, 0x0C), (0xFF, 0xE0, 0xB2), "落日橙"),
]

# Windows 自带的中文字体；找不到就退回 Pillow 内置位图字体（英文可读，中文会成方块）
FONT_CANDIDATES = [
    Path(r"C:\Windows\Fonts\msyhbd.ttc"),
    Path(r"C:\Windows\Fonts\msyh.ttc"),
    Path(r"C:\Windows\Fonts\simhei.ttf"),
]


def load_font(size: int) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    for path in FONT_CANDIDATES:
        if path.exists():
            try:
                return ImageFont.truetype(str(path), size)
            except OSError:
                continue
    print("! 没找到中文字体，文字可能显示成方块", file=sys.stderr)
    return ImageFont.load_default()


def diagonal_gradient(width: int, height: int, top_left, bottom_right) -> Image.Image:
    """从左上到右下的线性渐变。用 numpy 算，比逐像素的 Python 循环快得多。"""
    xs = np.linspace(0.0, 1.0, width)[None, :]
    ys = np.linspace(0.0, 1.0, height)[:, None]
    t = (xs + ys) / 2.0

    canvas = np.zeros((height, width, 3), dtype=np.float64)
    for channel in range(3):
        start = float(top_left[channel])
        end = float(bottom_right[channel])
        canvas[:, :, channel] = start + (end - start) * t

    return Image.fromarray(canvas.astype(np.uint8), "RGB")


def add_soft_circles(base: Image.Image, spots) -> None:
    """叠几团半透明的圆形，做出「水墨晕开」的层次，避免纯渐变太寡淡。"""
    layer = Image.new("RGBA", base.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(layer)

    for cx, cy, radius, alpha in spots:
        draw.ellipse(
            (cx - radius, cy - radius, cx + radius, cy + radius),
            fill=(255, 255, 255, alpha),
        )

    layer = layer.filter(ImageFilter.GaussianBlur(base.size[0] // 30))
    base.alpha_composite(layer.convert("RGBA"))


def draw_text_with_shadow(draw: ImageDraw.ImageDraw, xy, text, font, fill=(255, 255, 255)) -> None:
    """深色字影 + 白字：不管落在深色还是浅色区域都能看清。"""
    x, y = xy
    draw.text((x + 3, y + 3), text, font=font, fill=(0, 0, 0, 90))
    draw.text((x, y), text, font=font, fill=fill)


def centered_text(draw: ImageDraw.ImageDraw, xy, text, font, fill=(255, 255, 255)) -> None:
    x, y = xy
    box = draw.textbbox((0, 0), text, font=font)
    draw_text_with_shadow(draw, (x - (box[2] - box[0]) / 2, y - (box[3] - box[1]) / 2), text, font, fill)


def make_cover(width: int = 1600, height: int = 900) -> Image.Image:
    """卡片背景用的封面图。

    文字刻意集中在中上部：列表页卡片的标题压在**下半部分**，
    这样一来看卡片时能同时看到「图片本身」和「上面的深色渐变压住了什么」。
    """
    base = diagonal_gradient(width, height, (0x1C, 0x19, 0x17), (0xE4, 0x51, 0x3A)).convert("RGBA")
    add_soft_circles(
        base,
        [
            (width * 0.78, height * 0.24, width * 0.26, 70),
            (width * 0.16, height * 0.78, width * 0.22, 46),
            (width * 0.52, height * 0.55, width * 0.18, 30),
        ],
    )

    draw = ImageDraw.Draw(base)

    # 左上角标出来源，方便和正文配图区分
    tag_font = load_font(38)
    draw.rounded_rectangle((56, 52, 56 + 470, 52 + 74), radius=18, fill=(0, 0, 0, 70))
    draw.text((78, 66), "demo-cover.jpg", font=load_font(34), fill=(255, 255, 255, 235))

    centered_text(draw, (width / 2, height * 0.36), "封面图", load_font(150))
    centered_text(
        draw,
        (width / 2, height * 0.54),
        "列表页卡片会以它为背景",
        load_font(52),
    )
    centered_text(
        draw,
        (width / 2, height * 0.66),
        "花城博客 · 图片与封面自检",
        load_font(40),
        fill=(255, 255, 255, 220),
    )

    return base.convert("RGB")


def make_body_image(index: int, name: str, width: int = 1200, height: int = 800) -> Image.Image:
    """正文配图：编号 + 斜条纹，一眼就能认出「缩略图带里的是第几张」。"""
    dark, light, label = PALETTE[index % len(PALETTE)]
    base = diagonal_gradient(width, height, dark, light).convert("RGBA")
    add_soft_circles(base, [(width * 0.8, height * 0.18, width * 0.3, 60)])

    draw = ImageDraw.Draw(base)

    # 右下角斜条纹，用来判断 object-cover 的裁切方向
    stripe = Image.new("RGBA", base.size, (0, 0, 0, 0))
    stripe_draw = ImageDraw.Draw(stripe)
    step = 74
    for offset in range(-height, width + height, step * 2):
        stripe_draw.polygon(
            [
                (offset, height),
                (offset + step, height),
                (offset + step + height, 0),
                (offset + height, 0),
            ],
            fill=(255, 255, 255, 26),
        )
    base.alpha_composite(stripe)

    centered_text(draw, (width / 2, height * 0.34), str(index + 1), load_font(250))
    centered_text(draw, (width / 2, height * 0.70), f"正文配图 {index + 1} · {label}", load_font(52))
    centered_text(draw, (width / 2, height * 0.85), name, load_font(34), fill=(255, 255, 255, 215))

    return base.convert("RGB")


def main() -> int:
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    targets: list[tuple[str, Image.Image]] = [("demo-cover.jpg", make_cover())]
    for index in range(5):
        name = f"demo-0{index + 1}.jpg"
        targets.append((name, make_body_image(index, name)))

    total = 0
    for name, image in targets:
        path = OUT_DIR / name
        image.save(path, "JPEG", quality=82, optimize=True, progressive=True)
        size = path.stat().st_size
        total += size
        print(f"  {name}  {image.width}×{image.height}  {size / 1024:.0f}KB")

    print(f"\n共 {len(targets)} 张，{total / 1024:.0f}KB → {OUT_DIR}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
