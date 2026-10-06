"""把 public/emojis/ 里的表情图缩到统一尺寸。

跑法（通常不用手动跑，``npm run emoji:pack`` 会自动调用）：

    python scripts/shrink-emoji-pack.py

为什么要缩这一步：

- 原图是 256px 的 PNG，平均 30~40 KB。500 张就是十几 MB，
  而它们在面板里只有 **24px**、粘到评论区里也就 **128px** 上下。
- 缩完之后单张 8~12 KB，观感几乎没差别，仓库与流量都省掉一大半。

⚠️ 需要 Python + Pillow。**没有装也不影响**： ``npm run emoji:pack``
会检测到缺失并跳过这一步（原图照常可用，只是大一些）。
"""

from __future__ import annotations

import sys
from pathlib import Path

try:
    from PIL import Image
except ImportError:
    print("没有 Pillow，跳过压缩（pip install Pillow 之后再跑一次即可）")
    sys.exit(0)

TARGET = 128
EXTS = {".png", ".jpg", ".jpeg", ".webp"}

root = Path(__file__).resolve().parent.parent
src = root / "public" / "emojis"

if not src.is_dir():
    print(f"目录不存在：{src}")
    sys.exit(1)

saved = 0
kept = 0
before = 0
after = 0

for path in sorted(src.iterdir()):
    if not path.is_file() or path.suffix.lower() not in EXTS:
        continue

    # EXTS 里故意不含 GIF：压缩动图要逐帧重编，收益没那么大，直接放过
    try:
        with Image.open(path) as img:
            if img.width <= TARGET:
                before += path.stat().st_size
                after += path.stat().st_size
                kept += 1
                continue

            scale = TARGET / img.width
            height = max(1, round(img.height * scale))
            resized = img.resize((TARGET, height), Image.LANCZOS)
            if resized.mode not in ("RGBA", "RGB", "P"):
                resized = resized.convert("RGBA")

            size_before = path.stat().st_size
            if path.suffix.lower() == ".png":
                resized.save(path, format="PNG", optimize=True)
            else:
                resized.save(path, optimize=True)

            size_after = path.stat().st_size
            before += size_before
            after += size_after
            saved += 1
    except Exception as err:  # noqa: BLE001 —— 单张坏了不该中断整批
        print(f"  ! {path.name} 跳过：{err}")

print(f"压缩 {saved} 张，已是小图 {kept} 张")
if before:
    print(f"体积 {before / 1024 / 1024:.2f} MB → {after / 1024 / 1024:.2f} MB")
