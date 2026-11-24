"""Generate the five study volumes from reviewed prose and the project's source snapshot.

Run with a dedicated Python environment containing reportlab and pypdf.
Never reads .env, downloaded dependencies, database dumps or generated app files.
"""
from pathlib import Path
import hashlib
import html
import json
import re
import textwrap
import xml.etree.ElementTree as ET
from datetime import datetime
from zoneinfo import ZoneInfo

from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (BaseDocTemplate, PageTemplate, Frame, Paragraph, Spacer,
    PageBreak, Preformatted, Table, TableStyle, KeepTogether, Flowable)
from reportlab.platypus.tableofcontents import TableOfContents
from pypdf import PdfReader, PdfWriter

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'output/pdf'
SOURCES = ROOT / 'docs/manual'
BLUE = colors.HexColor('#072C50')
ACCENT = colors.HexColor('#1464A5')
PALE = colors.HexColor('#EFF5FA')
GRAY = colors.HexColor('#536577')
WIDTH, HEIGHT = 210*mm, 297*mm
MARGIN = 19*mm
CONTENT = WIDTH-2*MARGIN
MODULES = ['ms-usuarios','ms-cuentas','ms-transacciones','ms-prestamos','ms-auditoria']
DATE = '17 de noviembre de 2026'

for name, filename in [('Body','calibri.ttf'),('Bold','calibrib.ttf'),('Italic','calibrii.ttf'),('Mono','consola.ttf')]:
    pdfmetrics.registerFont(TTFont(name, 'C:/Windows/Fonts/'+filename))
pdfmetrics.registerFontFamily('Body', normal='Body', bold='Bold', italic='Italic', boldItalic='Bold')
styles = {
 'p': ParagraphStyle('p',fontName='Body',fontSize=10.3,leading=14.6,spaceAfter=7,textColor=BLUE,splitLongWords=True),
 'h1': ParagraphStyle('h1',fontName='Bold',fontSize=22,leading=26,spaceAfter=15,textColor=BLUE,keepWithNext=True),
 'h2': ParagraphStyle('h2',fontName='Bold',fontSize=14,leading=18,spaceBefore=14,spaceAfter=8,textColor=ACCENT,keepWithNext=True),
 'h3': ParagraphStyle('h3',fontName='Bold',fontSize=11.4,leading=15,spaceBefore=10,spaceAfter=6,textColor=BLUE,keepWithNext=True),
 'small': ParagraphStyle('small',fontName='Body',fontSize=8.2,leading=11,spaceAfter=7,textColor=GRAY,splitLongWords=True),
 'cell': ParagraphStyle('cell',fontName='Body',fontSize=8.4,leading=11,textColor=BLUE,splitLongWords=True),
 'bullet': ParagraphStyle('bullet',fontName='Body',fontSize=10.1,leading=14,leftIndent=12,firstLineIndent=-8,spaceAfter=5,textColor=BLUE),
 'code': ParagraphStyle('code',fontName='Mono',fontSize=8.2,leading=11,backColor=PALE,borderPadding=9,spaceBefore=6,spaceAfter=9),
}


def clean(value):
    return str(value).replace('\u2011','-').replace('\u2013','-').replace('\u2014','-').replace('→','->').replace('≤','<=').replace('≥','>=')


def inline(value):
    result=html.escape(clean(value))
    result=re.sub(r'`([^`]+)`',r'<font name="Mono" size="9">\1</font>',result)
    result=re.sub(r'\*\*([^*]+)\*\*',r'<b>\1</b>',result)
    result=re.sub(r'\[([^\]]+)\]\((https?://[^)]+)\)',r'<link href="\2" color="#1464A5">\1</link>',result)
    return result


def para(value, kind='p'):
    return Paragraph(inline(value),styles[kind])


def code(value):
    lines=[]
    for line in clean(value).expandtabs(4).splitlines():
        wrapped=textwrap.wrap(line,width=94,replace_whitespace=False,drop_whitespace=False,subsequent_indent='    ',break_long_words=True,break_on_hyphens=False) or ['']
        lines.extend(wrapped)
    return [Preformatted('\n'.join(lines[i:i+44]),styles['code']) for i in range(0,len(lines),44)]


def table(rows, widths=None):
    cols=len(rows[0])
    cells=[[para(c,'cell') for c in row] for row in rows]
    t=Table(cells,colWidths=widths or [CONTENT/cols]*cols,repeatRows=1,hAlign='LEFT')
    t.setStyle(TableStyle([
        ('BACKGROUND',(0,0),(-1,0),colors.HexColor('#DCEAF6')),
        ('ROWBACKGROUNDS',(0,1),(-1,-1),[colors.white,PALE]),
        ('LINEBELOW',(0,0),(-1,0),0.6,ACCENT),('VALIGN',(0,0),(-1,-1),'TOP'),
        ('LEFTPADDING',(0,0),(-1,-1),7),('RIGHTPADDING',(0,0),(-1,-1),7),
        ('TOPPADDING',(0,0),(-1,-1),7),('BOTTOMPADDING',(0,0),(-1,-1),7),
    ]))
    return t


class Diagram(Flowable):
    def __init__(self,kind):
        super().__init__();self.kind=kind;self.width=CONTENT;self.height=235 if kind=='architecture' else 180
    def draw(self):
        c=self.canv
        def box(x,y,w,h,title,detail=''):
            c.setFillColor(PALE);c.setStrokeColor(ACCENT);c.roundRect(x,y,w,h,7,stroke=1,fill=1)
            c.setFillColor(BLUE);c.setFont('Bold',10);c.drawCentredString(x+w/2,y+h-18,title)
            c.setFont('Body',8)
            for n,line in enumerate(detail.split('|')):c.drawCentredString(x+w/2,y+h-32-n*10,line)
        def arrow(x1,y1,x2,y2):
            c.setStrokeColor(ACCENT);c.line(x1,y1,x2,y2)
            c.line(x2,y2,x2-3,y2+5);c.line(x2,y2,x2+3,y2+5)
        w=self.width
        if self.kind=='architecture':
            box(w/2-105,177,210,48,'Navegador / Angular','Formularios, rutas, estado de interfaz')
            box(w/2-105,111,210,48,'Nginx /api','Proxy hacia el servicio propietario')
            arrow(w/2,177,w/2,159)
            names=['Usuarios','Cuentas','Transacciones','Préstamos','Auditoría']
            for i,name in enumerate(names):
                x=i*(w/5)+2;box(x,38,w/5-5,53,name,str(8081+i)+' | Esquema propio')
                c.line(w/2,111,x+(w/5-5)/2,91)
            c.setFillColor(GRAY);c.setFont('Body',9);c.drawCentredString(w/2,15,'MySQL compartido físicamente; cinco esquemas lógicos.')
        elif self.kind=='transfer':
            names=[('Cliente','Clave de operación'),('Transacciones','Orquesta y registra'),('Cuentas','Bloqueo + saldo')]
            for i,(name,detail) in enumerate(names):box(5+i*(w/3),105,w/3-12,55,name,detail)
            c.setStrokeColor(ACCENT);c.line(w/3-7,132,w/3+5,132);c.line(2*w/3-7,132,2*w/3+5,132)
            box(30,13,w-60,65,'Una transacción local en Cuentas','A: 1000.00 -> 874.50 | B: 0.00 -> 125.50|movimientos_aplicados conserva clave y huella')
        else:
            box(5,102,w*.43,62,'Productor','Cambio de negocio + evento|Misma transacción local')
            box(w*.55,102,w*.43,62,'Receptor','UUID único + comparación|Confirma recepción')
            c.setStrokeColor(ACCENT);c.line(w*.44,131,w*.55,131)
            box(40,12,w-80,66,'Reintento del outbox','Pendiente en disco mientras el receptor falla|Se retira solo al recibir confirmación|La entrega puede repetirse; el efecto se deduplica')


class ManualDoc(BaseDocTemplate):
    def __init__(self,path,title,volume):
        super().__init__(str(path),pagesize=(WIDTH,HEIGHT),leftMargin=MARGIN,rightMargin=MARGIN,topMargin=23*mm,bottomMargin=20*mm,title=title,author='Manual de estudio FinTechPro',allowSplitting=1)
        self.volume=volume;self.manual_title=title;self.seq=0
        self.addPageTemplates(PageTemplate(id='manual',frames=[Frame(MARGIN,20*mm,CONTENT,HEIGHT-43*mm,id='main',leftPadding=0,rightPadding=0,topPadding=0,bottomPadding=0)],onPage=self.decorate))
    def beforeDocument(self):
        self.seq=0
    def decorate(self,c,doc):
        if doc.page==1:
            c.setFillColor(BLUE);c.rect(0,HEIGHT-85*mm,WIDTH,85*mm,fill=1,stroke=0)
            c.setFillColor(ACCENT);c.rect(0,HEIGHT-88*mm,WIDTH,3*mm,fill=1,stroke=0)
        else:
            c.setFont('Bold',8);c.setFillColor(ACCENT);c.drawString(MARGIN,HEIGHT-13*mm,'FINTECHPRO  /  CUADERNOS DE INGENIERÍA DE SOFTWARE')
            c.setStrokeColor(colors.HexColor('#D9E4EC'));c.line(MARGIN,HEIGHT-16*mm,WIDTH-MARGIN,HEIGHT-16*mm)
        c.setFillColor(GRAY);c.setFont('Body',8);c.drawString(MARGIN,10*mm,f'Tomo {self.volume}  |  Edición de estudio - {DATE}')
        c.drawRightString(WIDTH-MARGIN,10*mm,str(doc.page))
    def afterFlowable(self,f):
        if isinstance(f,Paragraph) and hasattr(f,'toc_level'):
            self.seq+=1;key='section-'+str(self.seq)
            self.canv.bookmarkPage(key)
            self.canv.addOutlineEntry(f.getPlainText(),key,level=f.toc_level,closed=False)
            self.notify('TOCEntry',(f.toc_level,f.getPlainText(),self.page,key))


def heading(value,level=1):
    p=para(value,'h'+str(level))
    if level<3:p.toc_level=level-1
    return p


def source_snippet(spec):
    parts=spec.strip().split('|');path=ROOT/parts[0]
    if path.name=='.env' or not path.is_file():raise ValueError('Invalid source: '+str(path))
    lines=path.read_text(encoding='utf-8-sig').splitlines()
    start,end=1,len(lines)
    if len(parts)>1:
        start,end=map(int,parts[1].split(':'));end=min(end,len(lines))
    if start<1 or start>end:raise ValueError('Invalid source range: '+spec)
    result=[para(f'Código real: {parts[0]}, líneas {start}-{end}.','small')]
    result+=code('\n'.join(f'{n:03} {lines[n-1]}' for n in range(start,end+1)))
    return result


def markdown(text):
    output=[];lines=text.splitlines();i=0
    while i<len(lines):
        line=lines[i].strip()
        if not line:i+=1;continue
        if line.startswith('```'):
            i+=1;block=[]
            while i<len(lines) and not lines[i].startswith('```'):block.append(lines[i]);i+=1
            output+=code('\n'.join(block));i+=1;continue
        if line.startswith(':::source '):output+=source_snippet(line[len(':::source '):]);i+=1;continue
        if line.startswith(':::diagram '):output.append(Diagram(line.split()[-1]));output.append(Spacer(1,8));i+=1;continue
        if line==':::page':output.append(PageBreak());i+=1;continue
        if line.startswith('|'):
            rows=[]
            while i<len(lines) and lines[i].strip().startswith('|'):
                row=[cell.strip() for cell in lines[i].strip().strip('|').split('|')]
                if not all(re.fullmatch(r'[-: ]+',cell) for cell in row):rows.append(row)
                i+=1
            output.append(table(rows));output.append(Spacer(1,10));continue
        match=re.match(r'^(#{1,3}) (.*)',line)
        if match:
            level=len(match[1])
            if level==1 and output:output.append(PageBreak())
            output.append(heading(match[2],level));i+=1;continue
        if re.match(r'^[-*] ',line):output.append(para('• '+line[2:],'bullet'));i+=1;continue
        if re.match(r'^\d+\. ',line):output.append(para(line,'bullet'));i+=1;continue
        paragraph=[line];i+=1
        while i<len(lines) and lines[i].strip() and not re.match(r'^(#|```|:::|\||[-*] |\d+\. )',lines[i].strip()):paragraph.append(lines[i].strip());i+=1
        output.append(para(' '.join(paragraph)))
    return output


def own_files():
    roots=[ROOT/m/'src' for m in MODULES]+[ROOT/'frontend-angular/src',ROOT/'scripts',ROOT/'.github',ROOT/'docs']
    files=[]
    for directory in roots:
        for path in directory.rglob('*'):
            rel=path.relative_to(ROOT)
            if not path.is_file() or any(part in {'node_modules','target','__pycache__','manual'} for part in rel.parts):continue
            if path.suffix.lower() in {'.java','.ts','.css','.sql','.properties','.json','.py','.ps1','.md','.yml','.html'}:files.append(path)
    for pattern in ['*.xml','*.sql','*.yml','*.json','*.md']:
        files.extend(p for p in ROOT.glob(pattern) if p.name not in {'package-lock.json','FinTechPro.postman_collection.json'})
    files.extend([ROOT/'.env.example',ROOT/'.gitignore',ROOT/'frontend-angular/package.json',ROOT/'frontend-angular/package-lock.json',ROOT/'frontend-angular/angular.json',ROOT/'frontend-angular/nginx.conf',ROOT/'frontend-angular/Dockerfile'])
    files.extend(ROOT/m/'pom.xml' for m in MODULES)
    files.extend(ROOT/m/'Dockerfile' for m in MODULES)
    files.extend((ROOT/'frontend-angular').glob('tsconfig*.json'))
    files.append(ROOT/'frontend-angular/proxy.conf.json')
    files.extend(ROOT/m/'.dockerignore' for m in [*MODULES,'frontend-angular'])
    return sorted(set(p for p in files if p.exists()))


def describe(path):
    rel=path.relative_to(ROOT).as_posix();name=path.stem
    if '/migration/' in rel:return 'Migración versionada: evolución física del esquema.'
    if '/dto/' in rel:return 'Contrato de entrada/salida; tipos y validaciones del intercambio.'
    if '/entity/' in rel:return 'Modelo persistente; columnas y estados del dominio.'
    if '/repository/' in rel:return 'Acceso a datos, consultas y/o bloqueos de filas.'
    if '/controller/' in rel:return 'Adaptador HTTP; rutas, parámetros y códigos de respuesta.'
    if '/client/' in rel:return 'Contrato Feign para una llamada a otro servicio.'
    if '/test/' in rel or '.spec.' in rel:return 'Pruebas automatizadas; escenarios de regresión.'
    if '/security/' in rel or name=='SecurityConfig':return 'Autenticación, autorización o respuesta de seguridad.'
    if '/ia/' in rel:return 'Integración de IA; consultar el tomo IV para sus límites.'
    if '/pages/' in rel:return 'Vista o estilo de un flujo de cliente/administrador.'
    if '/services/' in rel:return 'Cliente HTTP o estado de sesión/operación del frontend.'
    if '/service/' in rel:return 'Reglas de negocio, coordinación o entrega de eventos.'
    if '/config/' in rel:return 'Configuración de infraestructura del servicio.'
    if rel.startswith('scripts/'):return 'Herramienta operativa, generador o comprobación de integración.'
    if rel.startswith('docs/'):return 'Documentación temática; contrastar su fecha con esta edición.'
    if path.name=='pom.xml':return 'Dependencias, compilación y empaquetado Maven.'
    if 'Dockerfile' in path.name or 'compose' in path.name:return 'Construcción u orquestación de contenedores.'
    return 'Configuración o código de soporte; leer junto a su módulo.'


def reference_appendix():
    out=[PageBreak(),heading('A. Catálogo de endpoints del código actual')]
    out.append(para('Este catálogo se extrae de los controladores, no de clientes Feign. Un mapping no concede permiso: contrastar cada entrada con SecurityConfig, Acceso y la matriz explicada en el tomo II. Las firmas conservan @Valid, @RequestParam y @RequestHeader. Las rutas de /health pertenecen al puerto de cada servicio; Nginx no publica un /health agregado.'))
    for module in MODULES:
        out.append(heading(module,2))
        paths=sorted((ROOT/module/'src/main/java').rglob('*.java'))
        for path in paths:
            text=path.read_text(encoding='utf-8-sig')
            if '@RestController' not in text:continue
            class_start=text.find('public class ')
            base_match=re.search(r'@RequestMapping\(\s*"([^"]*)"',text[:class_start])
            base=base_match[1] if base_match else ''
            for match in re.finditer(r'@(Get|Post|Put|Patch|Delete)Mapping(?:\(([^\n]*?)\))?',text):
                method=match[1].upper();part=re.search(r'"([^"]*)"',match[2] or '')
                route=base+(part[1] if part else '')
                rest=text[match.end():];signature=re.search(r'public\s+[^{}]+?\{',rest)
                if not signature:continue
                line=text.count('\n',0,match.start())+1
                out.append(heading(method+' '+(route or '/'),3))
                out.append(para(f'{path.relative_to(ROOT).as_posix()}:{line}','small'))
                out+=code(re.sub(r'\s+',' ',signature[0].rstrip('{')).strip())
    out += [PageBreak(),heading('B. Contratos y validaciones de entrada')]
    out.append(para('Se reproducen los DTO y records del repositorio que definen peticiones y respuestas. Los import y package se omiten para facilitar la lectura. Las restricciones de negocio adicionales viven en los servicios: @NotNull no sustituye verificar propiedad, estado, moneda o saldo.'))
    for module in MODULES:
        out.append(heading(module,2))
        for path in sorted((ROOT/module/'src/main/java').rglob('*.java')):
            if '/dto/' not in path.as_posix() and path.name not in {'AsistenteRequest.java','AsistenteResponse.java'}:continue
            text=path.read_text(encoding='utf-8-sig')
            text='\n'.join(line for line in text.splitlines() if not line.startswith(('package ','import ')))
            out.append(heading(path.name,3));out.append(para(path.relative_to(ROOT).as_posix(),'small'));out+=code(text.strip())
    out += [PageBreak(),heading('C. Modelos persistentes y diccionario de campos')]
    out.append(para('Cada tabla pertenece al esquema de su servicio. Las relaciones entre servicios se representan por identificadores y contratos HTTP, sin una relación JPA entre sus procesos. Las anotaciones de columnas y enums se muestran como diccionario del modelo; el DDL definitivo es la secuencia de migraciones del apartado D. Auditoria de Usuarios permanece como archivo histórico y compatibilidad: el diario activo pertenece a ms-auditoria.'))
    for module in MODULES:
        out.append(heading(module,2))
        for path in sorted((ROOT/module/'src/main/java').rglob('*.java')):
            if '/entity/' not in path.as_posix():continue
            text=path.read_text(encoding='utf-8-sig')
            text='\n'.join(line for line in text.splitlines() if not line.startswith(('package ','import ')))
            out.append(heading(path.name,3));out.append(para(path.relative_to(ROOT).as_posix(),'small'));out+=code(text.strip())
    out += [PageBreak(),heading('D. DDL y evolución: todas las migraciones')]
    out.append(para('Estas migraciones se incluyen para reconstruir el historial, no para ejecutarlas manualmente una sobre otra en la base de trabajo. Flyway lleva su registro en flyway_schema_history. No concatenar V1 de módulos distintos dentro del mismo esquema ni editar una versión ya aplicada.'))
    for module in MODULES:
        out.append(heading(module,2))
        for path in sorted((ROOT/module/'src/main/resources/db/migration').glob('*.sql')):
            out.append(heading(path.name,3));out.append(para(path.relative_to(ROOT).as_posix(),'small'));out+=code(path.read_text(encoding='utf-8-sig'))
    out += [PageBreak(),heading('E. Inventario trazable de archivos propios')]
    out.append(para('Inventario con ruta, propósito, tamaño en líneas y huella abreviada SHA-256 de esta edición. Se excluyen dependencias, binarios, .env real, respaldos, node_modules, target, dist y herramientas temporales del PDF. Una huella permite detectar un cambio de archivo, no acredita por sí misma su corrección.'))
    for path in own_files():
        raw=path.read_bytes();count=len(raw.decode('utf-8-sig',errors='replace').splitlines())
        out.append(KeepTogether([para(f'**{path.relative_to(ROOT).as_posix()}**','small'),
            para(f'{describe(path)} {count} líneas. SHA-256: {hashlib.sha256(raw).hexdigest()[:16]}.','small')]))
    out += [PageBreak(),heading('F. Configuración y dependencias para reproducir')]
    out.append(para('Los archivos siguientes son configuración del proyecto, no los secretos efectivos del equipo. .env.example contiene marcadores de sustitución. Las propiedades locales de desarrollo y las variables inyectadas por Compose pueden diferir: usa las instrucciones del tomo I para interpretar su precedencia. Las imágenes con etiquetas y los rangos de npm deben contrastarse con el lock y, para una reproducción binaria, con sus digest.'))
    ns={'m':'http://maven.apache.org/POM/4.0.0'}
    for module in MODULES:
        tree=ET.parse(ROOT/module/'pom.xml').getroot()
        out.append(heading('Dependencias de '+module,2))
        rows=[['Dependencia','Versión declarada / gestión','Ámbito']]
        for item in tree.findall('m:dependencies/m:dependency',ns):
            value=lambda tag: item.findtext('m:'+tag,default='',namespaces=ns)
            rows.append([value('groupId')+':'+value('artifactId'),value('version') or 'Gestionada por parent/BOM',value('scope') or 'compile'])
        out.append(table(rows,[CONTENT*.48,CONTENT*.34,CONTENT*.18]))
        out.append(Spacer(1,9))
    out.append(heading('Configuración del frontend',2))
    for rel in ['frontend-angular/package.json','frontend-angular/angular.json','frontend-angular/tsconfig.json','frontend-angular/tsconfig.app.json','frontend-angular/tsconfig.spec.json','frontend-angular/proxy.conf.json','frontend-angular/src/environments/environment.ts','frontend-angular/src/environments/environment.prod.ts','frontend-angular/nginx.conf','frontend-angular/Dockerfile']:
        out.append(heading(rel,3));out+=code((ROOT/rel).read_text(encoding='utf-8-sig'))
    out.append(heading('Configuración de los cinco backend',2))
    for module in MODULES:
        rel=module+'/src/main/resources/application.properties'
        out.append(heading(module,3));out.append(para(rel,'small'));out+=code((ROOT/rel).read_text(encoding='utf-8-sig'))
    out.append(heading('Contenedores, variables de ejemplo y CI',2))
    for rel in ['.env.example','init-db.sql','docker-compose.yml','docker-compose.ollama.yml','docker-compose.ollama.gpu.yml','ms-cuentas/Dockerfile','.github/workflows/verify.yml','scripts/operations.example.json','scripts/install_operations_task.ps1']:
        out.append(heading(rel,3));out+=code((ROOT/rel).read_text(encoding='utf-8-sig'))
    return out


VOLUMES=[
 ('01','Arquitectura y puesta en marcha','Comprender el sistema, preparar el entorno y reproducir el arranque.'),
 ('02','Backend, datos y lógica financiera','Construir los cinco servicios, sus reglas y sus mecanismos de consistencia.'),
 ('03','Frontend y experiencia de usuario','Reconstruir Angular, formularios, navegación y recorridos por rol.'),
 ('04','IA, eventos y operación','Entender los asistentes, la auditoría, las notificaciones y la recuperación.'),
 ('05','Laboratorios y referencia del código','Practicar por sesiones y consultar contratos, modelos y migraciones.')]


def build():
    OUT.mkdir(parents=True,exist_ok=True)
    generated=[]
    for number,title,subtitle in VOLUMES:
        white=ParagraphStyle('coverTitle',fontName='Bold',fontSize=31,leading=35,textColor=colors.white,spaceAfter=14)
        label=ParagraphStyle('coverLabel',fontName='Bold',fontSize=13,leading=17,textColor=colors.HexColor('#ACD8FF'),spaceAfter=13)
        story=[Paragraph('FINTECHPRO / TOMO '+number,label),Paragraph(title,white),Spacer(1,60*mm),para(subtitle),Spacer(1,7*mm),para('MANUAL DE ESTUDIO Y RECONSTRUCCIÓN','h2'),para('Java 17 · Spring Boot · MySQL · Angular · Docker · Ollama'),para('Basado en los archivos propios del proyecto. Edición '+DATE+'.'),para('Autoría editorial: documentación técnica asistida por IA. No representa una publicación ni una certificación de una universidad.','small'),para('Leer, reconstruir, comprobar y explicar: los cuatro pasos de cada laboratorio.','small'),PageBreak(),heading('Guía de lectura')]
        story.append(para('Los cinco tomos forman una ruta continua. Cada uno puede consultarse por separado. Los ejemplos con cuentas, contraseñas y fondos son exclusivamente de demostración. Las referencias a archivos usan rutas relativas a la raíz que contiene docker-compose.yml.'))
        story.append(para('En el PDF unificado, cada tomo conserva su portada, índice y numeración local. Los marcadores laterales permiten saltar entre capítulos. El anexo del tomo V contiene la referencia del código de esta edición, no solo una descripción conceptual.'))
        for n,t,s in VOLUMES:story.append(para(f'**Tomo {n}. {t}.** {s}'))
        toc=TableOfContents();toc.levelStyles=[ParagraphStyle('toc0',fontName='Bold',fontSize=10.5,leading=15,spaceBefore=8,textColor=BLUE),ParagraphStyle('toc1',fontName='Body',fontSize=9.3,leading=12,leftIndent=12,textColor=GRAY)]
        story += [heading('Índice del tomo',2),toc,PageBreak()]
        source=SOURCES/f'tomo_{number}.md'
        story+=markdown(source.read_text(encoding='utf-8'))
        if number=='05':story+=reference_appendix()
        path=OUT/f'FinTechPro_Tomo_{number}.pdf'
        doc=ManualDoc(path,title,number);doc.multiBuild(story)
        generated.append(path)
    combined=PdfWriter()
    for (number,title,_),path in zip(VOLUMES,generated):combined.append(str(path),outline_item=f'Tomo {number} - {title}')
    combined.add_metadata({'/Title':'FinTechPro - Manual completo de estudio y reconstrucción','/Author':'Manual de estudio FinTechPro','/Subject':'Arquitectura, backend, frontend, IA, operación y laboratorios'})
    full=OUT/'FinTechPro_Manual_Completo.pdf'
    with full.open('wb') as target:combined.write(target)
    manifest=[]
    for path in [*generated,full]:
        reader=PdfReader(path)
        manifest.append({'file':path.name,'pages':len(reader.pages),'bytes':path.stat().st_size,'sha256':hashlib.sha256(path.read_bytes()).hexdigest()})
    (OUT/'indice_y_verificacion.json').write_text(json.dumps(manifest,indent=2),encoding='utf-8')
    print(json.dumps(manifest,indent=2))


if __name__=='__main__':build()
