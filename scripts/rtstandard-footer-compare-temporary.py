"""Compare real website screenshot, Word render, and Chromium PDF footer."""
from pathlib import Path
import re
import fitz
from PIL import Image, ImageDraw, ImageFont

ROOT=Path("artifacts")
OUT=ROOT/"rtstandard-footer-visual"
OUT.mkdir(parents=True,exist_ok=True)
web=Image.open(OUT/"rtstandard-web-page.png").convert("RGB")
web_contacts=Image.open(OUT/"rtstandard-web-contacts.png").convert("RGB")
pdf_paths=[ROOT/"word-rendered"/"rtstandard.pdf", ROOT/"print-pdf"/"rtstandard.pdf"]
docs=[fitz.open(str(p)) for p in pdf_paths]
for label,doc in zip(["Word","PDF"],docs):
    text="\n".join(page.get_text() for page in doc)
    compact=re.sub(r"\s+","",text)
    assert re.sub(r"\s+","","+7 (981) 040-10-70") not in compact, label+" still contains removed mobile"
    assert re.sub(r"\s+","","+7 (812) 983-44-33") in compact, label+" lost remaining city phone"
    assert "info@liscorp.ru" in compact, label+" lost email"

def rendered_page(pdf,width):
    p=pdf[0]
    factor=width/p.rect.width
    pix=p.get_pixmap(matrix=fitz.Matrix(factor,factor),alpha=False)
    return Image.frombytes("RGB",(pix.width,pix.height),pix.samples)

def crop_footer(pdf,width):
    p=pdf[0]
    boxes=p.search_for("Коммерческий департамент")
    assert boxes, "Footer text not found in rendered Word/PDF"
    area=fitz.Rect(25,max(0,boxes[0].y0-36),min(p.rect.width-20,390),min(p.rect.height,boxes[0].y0+150))
    pix=p.get_pixmap(matrix=fitz.Matrix(2,2),clip=area,alpha=False)
    im=Image.frombytes("RGB",(pix.width,pix.height),pix.samples)
    return im

width=690
parts=[web.resize((width,round(web.height*width/web.width)),Image.Resampling.LANCZOS)]+[rendered_page(d,width) for d in docs]
try:
    font=ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",19)
except OSError: font=ImageFont.load_default()
labels=["Сайт · Chromium","Word · LibreOffice","PDF · Chromium"]
padding=16
header=45
maxheight=min(1200,max(im.height for im in parts))
canvas=Image.new("RGB",(width*3+padding*4,maxheight+header+padding*2),(239,243,246))
draw=ImageDraw.Draw(canvas)
for i,(im,label) in enumerate(zip(parts,labels)):
    x=padding+i*(width+padding)
    draw.text((x,10),label,fill=(22,34,45),font=font)
    canvas.paste(im.crop((0,0,width,min(im.height,maxheight))),(x,header+padding))
canvas.save(OUT/"rtstandard-3way-page.png",optimize=True)

footers=[web_contacts]+[crop_footer(d,width) for d in docs]
fw=700; fh=320
contact_canvas=Image.new("RGB",(3*fw+padding*4,fh+header+padding*2),(239,243,246))
draw=ImageDraw.Draw(contact_canvas)
for i,(im,label) in enumerate(zip(footers,labels)):
    x=padding+i*(fw+padding)
    draw.text((x,10),label,fill=(22,34,45),font=font)
    scale=min((fw-25)/im.width,(fh-22)/im.height)
    resized=im.resize((round(im.width*scale),round(im.height*scale)),Image.Resampling.LANCZOS)
    contact_canvas.paste(resized,(x+8,header+padding+10))
contact_canvas.save(OUT/"rtstandard-3way-footer.png",optimize=True)
print("PASS three-way real RTStandard footer comparison, removed mobile absent and remaining city phone preserved")
