# Manual de estudio FinTechPro

Edición del 17 de noviembre de 2026, America/Lima. Los cinco archivos `tomo_01.md` a `tomo_05.md` contienen el contenido didáctico editable. El generador incorpora además contratos, modelos, migraciones e inventario del código propio. No lee `.env` real ni bases de datos.

Los PDF finales se encuentran en `output/pdf/`. La versión unificada conserva la numeración local y los marcadores de cada tomo. El archivo `indice_y_verificacion.json` registra tamaños, número de páginas y SHA-256.

## Regeneración en Windows

```powershell
python -m venv tmp/pdf-env
./tmp/pdf-env/Scripts/python.exe -m pip install reportlab pypdf pymupdf
./tmp/pdf-env/Scripts/python.exe scripts/build_study_manual.py
```

El generador utiliza Calibri y Consolas de `C:/Windows/Fonts`. Para otro sistema hay que ajustar las rutas y utilizar fuentes equivalentes con sus permisos correspondientes. Estas herramientas son documentales y no se añaden a las dependencias de ejecución de la aplicación.

Para validar y renderizar las páginas se utiliza `scripts/check_study_manual.py`. Los intermedios están en `tmp/pdfs/` y no se incorporan al código de la aplicación.

## Alcance

Se documenta la implementación real y se distinguen los comandos propuestos de laboratorio de las comprobaciones históricas del entorno `fintech-verificacion`. No se ejecutan movimientos de dinero ni se recrean bases para generar el manual. La instalación de estudio usa otro nombre de Compose y puertos para evitar tocar datos existentes.

El contenido no atribuye autoría, empleo ni acreditación a Harvard o a otra universidad. Su objetivo es didáctico y técnico, con laboratorios y fuentes primarias del proyecto.
