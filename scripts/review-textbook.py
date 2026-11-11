"""Contact sheets for verifying figure bounds against the unchanged PDF pages."""
import re
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
from pypdf import PdfReader

root = Path(__file__).resolve().parent.parent
source = (root / 'src/textbook-catalog.ts').read_text(encoding='utf-8')
entries = re.findall(r"id:'([^']+)',pdf:(\d+),title:'([^']+)'.*?rect:\[([^\]]+)\]", source)
font = ImageFont.truetype('C:/Windows/Fonts/msyh.ttc', 17)
reader = PdfReader(root / 'output/reference/textbook.pdf')
for ident, pdf, title, _ in entries:
    page = reader.pages[int(pdf)-1]
    number = re.search(r'[0-9]+[.][0-9]+', title).group()
    found = []
    def text_visit(text, cm, tm, font, size):
        if number in text:
            found.append((round(tm[4]/float(page.mediabox.width), 3), round(1-tm[5]/float(page.mediabox.height), 3), text[:45].strip()))
    page.extract_text(visitor_text=text_visit)
    print(ident, found)
for batch in range(3):
    sheet = Image.new('RGB', (1600, 4*405), '#e9e7e1')
    draw = ImageDraw.Draw(sheet)
    for j, (ident, pdf, title, bounds) in enumerate(entries[batch*8:(batch+1)*8]):
        page = Image.open(root / 'public/textbook' / f'page-{int(pdf):03}.webp')
        x, y, w, h = [float(s) for s in bounds.split(',')]
        crop = page.crop((int(x*page.width), int(y*page.height), int((x+w)*page.width), int((y+h)*page.height)))
        crop.thumbnail((760, 340))
        left = j%2*800; top = j//2*405
        draw.text((left+15, top+8), f'{ident} / PDF {pdf} / {title}', fill='#162d38', font=font)
        sheet.paste(crop, (left+15, top+45))
    sheet.save(root / 'output/reference' / f'figure-bounds-{batch+1}.jpg', quality=92)
