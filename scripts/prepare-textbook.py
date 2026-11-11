"""Render the locally verified textbook without re-typesetting its pages.

Requires the Python/Pillow and Poppler runtimes already used for source review.
The original PDF remains in output/reference; only interior pages are rendered.
"""
from concurrent.futures import ThreadPoolExecutor
from io import BytesIO
from pathlib import Path
import json
import shutil
import subprocess
from PIL import Image, ImageDraw, ImageFont
from pypdf import PdfReader

ROOT = Path(__file__).resolve().parent.parent
PDF = ROOT / "output/reference/textbook.pdf"
DEST = ROOT / "public/textbook"
DEST.mkdir(parents=True, exist_ok=True)
POPPLER = shutil.which("pdftoppm")
reader = PdfReader(PDF)

def render(n):
    target = DEST / f"page-{n:03}.webp"
    if not target.exists():
        result = subprocess.run([POPPLER, "-f", str(n), "-l", str(n),
            "-singlefile", "-scale-to-x", "1530", "-scale-to-y", "-1",
            "-png", str(PDF)], capture_output=True, check=True)
        im = Image.open(BytesIO(result.stdout)).convert("RGB")
        im.save(target, "WEBP", quality=90, method=4)
        im.thumbnail((360, 520))
        im.save(DEST / f"thumb-{n:03}.webp", "WEBP", quality=78, method=4)
    return n

with ThreadPoolExecutor(max_workers=4) as pool:
    for count, n in enumerate(pool.map(render, range(2, len(reader.pages))), 1):
        if count % 20 == 0:
            print(f"Rendered {count}/132", flush=True)

pages = [{"pdf":n,"number":n-5 if 6<=n<=129 else None,
          "text":reader.pages[n-1].extract_text(),
          "width":float(reader.pages[n-1].mediabox.width),
          "height":float(reader.pages[n-1].mediabox.height)}
         for n in range(2,len(reader.pages))]
(DEST / "pages.json").write_text(json.dumps(pages,ensure_ascii=False),encoding="utf-8")

# Review contact sheets are evidence, never application assets.
review = ROOT / "output/reference"
targets=[8,14,21,27,36,39,41,43,52,56,63,65,72,75,77,79,82,88,94,106,108,112,115,120,121,123]
font=ImageFont.truetype("C:/Windows/Fonts/msyh.ttc",19)
for batch in range(3):
    sheet=Image.new("RGB",(1600,4*610),"#dedbd4")
    d=ImageDraw.Draw(sheet)
    for j,n in enumerate(targets[batch*9:(batch+1)*9]):
        im=Image.open(DEST/f"page-{n:03}.webp");im.thumbnail((510,565))
        x=(j%3)*533+(533-im.width)//2;y=(j//3)*610
        sheet.paste(im,(x,y+32));d.text((x,y+4),f"PDF {n} / 教材 {n-5}",font=font,fill="#111111")
    sheet.crop((0,0,1600,3*610)).save(review/f"fullbook-contact-{batch+1}.jpg",quality=90)
print(f"Ready: {len(pages)} original pages; {sum(p.stat().st_size for p in DEST.glob('*'))/1024/1024:.1f} MiB",flush=True)
