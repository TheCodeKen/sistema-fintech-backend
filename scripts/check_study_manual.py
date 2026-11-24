"""Render all study-volume pages and check bounds, text, links and excluded secrets."""
from pathlib import Path
import json
import math
import re
import pymupdf as fitz
from PIL import Image, ImageOps, ImageDraw
from pypdf import PdfReader

ROOT=Path(__file__).resolve().parents[1]
PDF=ROOT/'output/pdf'
TMP=ROOT/'tmp/pdfs'
TMP.mkdir(parents=True,exist_ok=True)
reports=[]

for path in sorted(PDF.glob('FinTechPro_Tomo_*.pdf')):
    doc=fitz.open(path);reader=PdfReader(path)
    folder=TMP/path.stem;folder.mkdir(exist_ok=True)
    findings=[];thumbnails=[];texts=[]
    for index,page in enumerate(doc):
        text=page.get_text();texts.append(text)
        if len(text.strip())<60:findings.append({'page':index+1,'type':'almost_empty'})
        for block in page.get_text('dict')['blocks']:
            for line in block.get('lines',[]):
                for span in line['spans']:
                    x0,y0,x1,y1=span['bbox']
                    if x0<12 or x1>page.rect.width-10 or y0<5 or y1>page.rect.height-5:
                        findings.append({'page':index+1,'type':'outside_bounds','text':span['text'][:70],'box':span['bbox']})
        for link in page.get_links():
            if link['kind']==fitz.LINK_GOTO and not 0<=link['page']<len(doc):
                findings.append({'page':index+1,'type':'broken_internal_link'})
        if '\ufffd' in text or '\u25a0' in text:findings.append({'page':index+1,'type':'unsupported_glyph'})
        pix=page.get_pixmap(matrix=fitz.Matrix(1.1,1.1),alpha=False)
        target=folder/f'page-{index+1:03}.png';pix.save(target)
        thumb=Image.open(target).convert('RGB');thumb.thumbnail((245,350))
        canvas=Image.new('RGB',(265,380),'#dce4ed');canvas.paste(thumb,((265-thumb.width)//2,9))
        ImageDraw.Draw(canvas).text((12,360),f'{path.stem} / {index+1}',fill='#072c50')
        thumbnails.append(canvas)
    joined='\n'.join(texts)
    if re.search(r'sk-[A-Za-z0-9_-]{18,}',joined):findings.append({'type':'possible_private_key'})
    if 'PLACEHOLDER' in joined or 'TODO' in joined:findings.append({'type':'editorial_placeholder'})
    for start in range(0,len(thumbnails),12):
        group=thumbnails[start:start+12]
        sheet=Image.new('RGB',(265*3,380*math.ceil(len(group)/3)),'white')
        for i,thumb in enumerate(group):sheet.paste(thumb,((i%3)*265,(i//3)*380))
        sheet.save(TMP/f'{path.stem}-contact-{start//12+1:02}.png')
    reports.append({'file':path.name,'pages':len(doc),'wordsApprox':len(joined.split()),'bookmarks':len(doc.get_toc()),'findings':findings})

full=PdfReader(PDF/'FinTechPro_Manual_Completo.pdf')
assert len(full.pages)==sum(r['pages'] for r in reports)
(TMP/'qa-report.json').write_text(json.dumps(reports,indent=2),encoding='utf-8')
print(json.dumps(reports,indent=2))
if any(r['findings'] for r in reports):raise SystemExit(1)
