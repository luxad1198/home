"""Temporary OOXML/Chromium PDF checks and three-column visual comparisons."""
from __future__ import annotations
import re
import zipfile
from pathlib import Path
from xml.etree import ElementTree as ET
import fitz
from PIL import Image, ImageDraw, ImageFont

ROOT = Path("artifacts")
OUT = ROOT / "pr21-compare"
OUT.mkdir(parents=True, exist_ok=True)
W = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"
NS = {"w":"http://schemas.openxmlformats.org/wordprocessingml/2006/main"}

def text(element):
    return "".join(x.text or "" for x in element.iter(W+"t"))

def paragraph_justification(cell):
    p=cell.find("w:p",NS)
    val=p.find("w:pPr/w:jc",NS) if p is not None else None
    return val.get(W+"val") if val is not None else "left"

def check_word(key):
    name={"ooo":"rtstandard","ip":"zakharov"}[key]
    path=ROOT/"word-docx"/(name+".docx")
    assert zipfile.is_zipfile(path), "DOCX ZIP missing "+str(path)
    with zipfile.ZipFile(path) as z:
        root=ET.fromstring(z.read("word/document.xml"))
    title=next(p for p in root.iter(W+"p") if text(p).strip()=="КОММЕРЧЕСКОЕ ПРЕДЛОЖЕНИЕ")
    spacing=title.find("w:pPr/w:spacing",NS)
    assert spacing is not None and spacing.get(W+"after")=="340", \
      "Word title spacing missing for "+key
    table=next(t for t in root.iter(W+"tbl")
      if "Наименование товара" in text(t) and "Цена за ед." in text(t))
    rows=table.findall("w:tr",NS)
    assert len(rows)>=3, "Expected equipment row and total row"
    data_cells=rows[1].findall("w:tc",NS)
    last_cells=rows[-1].findall("w:tc",NS)
    want="center" if key=="ip" else "right"
    assert paragraph_justification(data_cells[5])==want, \
      "Word price alignment "+key
    assert paragraph_justification(data_cells[6])==want, \
      "Word line total alignment "+key
    assert paragraph_justification(last_cells[-1])==want, \
      "Word grand total alignment "+key
    all_text=text(root)
    if key=="ip":
        paragraph=next(text(p) for p in root.iter(W+"p") if "Исх. № Q7" in text(p))
        assert re.search(r"Исх\. № Q7 от «\d{2}» [а-яё]+ \d{4} года",paragraph), \
          "Bad Word Zakharov date: "+repr(paragraph)
        assert "        " not in paragraph, "Old wide spacing remained"
    else:
        assert "КП №" in all_text
    return all_text

def check_pdf(key):
    name={"ooo":"rtstandard","ip":"zakharov"}[key]
    path=ROOT/"print-pdf"/(name+".pdf")
    assert path.is_file()
    doc=fitz.open(str(path))
    assert len(doc)>=1
    txt="\n".join(page.get_text(sort=True) for page in doc)
    assert "КОММЕРЧЕСКОЕ ПРЕДЛОЖЕНИЕ" in txt
    assert "24 000,00" in txt or "24000,00" in txt
    if key=="ip":
        compact=re.sub(r"\s+"," ",txt)
        assert re.search(r"«\d{2}» [а-яё]+ \d{4} года",compact), \
          "Bad printed date: "+repr(compact[:1200])
    return doc

def page_image(pdf, width):
    p=pdf[0]
    scale=width/p.rect.width
    pix=p.get_pixmap(matrix=fitz.Matrix(scale,scale),alpha=False)
    return Image.frombytes("RGB",[pix.width,pix.height],pix.samples)

try:
    font=ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",20)
except OSError:
    font=ImageFont.load_default()

for key in ("ooo","ip"):
    word_content=check_word(key)
    pdf=check_pdf(key)
    word_name={"ooo":"rtstandard","ip":"zakharov"}[key]
    rendered=ROOT/"word-rendered"/(word_name+".pdf")
    word_pdf=fitz.open(str(rendered))
    assert len(word_pdf)>=1, "Word render is empty"
    test_text="".join(p.get_text() for p in word_pdf)
    assert "КОММЕРЧЕСКОЕ ПРЕДЛОЖЕНИЕ" in test_text
    if key=="ip":
        assert re.search(r"«\d{2}»",test_text), "Rendered Word quote missing"
    site=Image.open(OUT/(key+"-web.png")).convert("RGB")
    width=790
    site=site.resize((width,round(site.height*width/site.width)),Image.Resampling.LANCZOS)
    rendered_images=[
        site,
        page_image(word_pdf,width),
        page_image(pdf,width)
    ]
    labels=["Сайт · Chromium","Word · LibreOffice","PDF · Chromium"]
    cropheight=min(1150,max(im.height for im in rendered_images))
    pad=18
    header=46
    canvas=Image.new("RGB",(3*width+4*pad,cropheight+header+2*pad),(238,242,245))
    draw=ImageDraw.Draw(canvas)
    for i,(image,label) in enumerate(zip(rendered_images,labels)):
        x=pad+i*(width+pad)
        draw.text((x,12),label,fill=(28,40,52),font=font)
        canvas.paste(image.crop((0,0,width,min(cropheight,image.height))),(x,header+pad))
    out=OUT/("compare-"+key+".png")
    canvas.save(out,optimize=True)
    print("COMPARED",key,out, "dimensions",canvas.size)

print("PASS: browser previews, DOCX OOXML and actual rendered Word/PDF verified.")
