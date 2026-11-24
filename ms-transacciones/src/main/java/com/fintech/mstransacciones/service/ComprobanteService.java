package com.fintech.mstransacciones.service;

import com.fintech.mstransacciones.dto.TransaccionDetalle;
import org.apache.pdfbox.pdmodel.*;
import org.apache.pdfbox.pdmodel.common.PDRectangle;
import org.apache.pdfbox.pdmodel.font.*;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;
import java.awt.Color;
import java.io.*;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;

/** Generates an in-memory receipt from the authorized, current transaction state. */
@Service
public class ComprobanteService {
    private static final PDType1Font NORMAL=new PDType1Font(Standard14Fonts.FontName.HELVETICA);
    private static final PDType1Font BOLD=new PDType1Font(Standard14Fonts.FontName.HELVETICA_BOLD);
    private static final Color NAVY=new Color(7,33,70), BLUE=new Color(20,100,165), MUTED=new Color(93,115,139);

    public byte[] generar(TransaccionDetalle detalle) {
        var t=detalle.movimiento();
        if(!"COMPLETADA".equals(t.getEstado()) && !"REVERTIDA".equals(t.getEstado()))
            throw new ResponseStatusException(HttpStatus.CONFLICT,"El comprobante solo está disponible para movimientos completados o revertidos");
        try(var doc=new PDDocument();var bytes=new ByteArrayOutputStream()) {
            var page=new PDPage(PDRectangle.A4);doc.addPage(page);
            doc.getDocumentInformation().setTitle("Comprobante "+t.getNumeroReferencia());
            doc.getDocumentInformation().setAuthor("FinTechPro");
            try(var c=new PDPageContentStream(doc,page)) {
                c.setNonStrokingColor(NAVY);c.addRect(0,722,page.getMediaBox().getWidth(),120);c.fill();
                texto(c,"FinTechPro",48,790,21,BOLD,Color.WHITE);
                texto(c,"COMPROBANTE DE MOVIMIENTO",48,756,11,NORMAL,Color.WHITE);
                texto(c,t.getMoneda()+" "+t.getMonto().setScale(2).toPlainString(),48,674,29,BOLD,NAVY);
                texto(c,t.getTipoTransaccion().replace('_',' '),48,644,12,NORMAL,BLUE);
                float y=605;
                y=fila(c,"Estado",t.getEstado(),y);
                y=fila(c,"Referencia",t.getNumeroReferencia(),y);
                y=fila(c,"Fecha del registro",t.getFechaTransaccion()==null ? "No disponible" : t.getFechaTransaccion().format(DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm:ss")),y);
                y=fila(c,t.getTipoTransaccion().equals("DEPOSITO") || t.getTipoTransaccion().equals("DESEMBOLSO_PRESTAMO") ? "Cuenta abonada" : "Cuenta de origen",cuenta(t.getNumeroCuentaOrigen(),t.getCuentaOrigenId()),y);
                if(t.getCuentaDestinoId()!=null)y=fila(c,"Cuenta de destino",cuenta(t.getNumeroCuentaDestino(),t.getCuentaDestinoId()),y);
                if(detalle.original()!=null)y=fila(c,"Movimiento original",detalle.original().getNumeroReferencia(),y);
                if(detalle.reversion()!=null)y=fila(c,"Reversión vinculada",detalle.reversion().getNumeroReferencia(),y);
                texto(c,"Concepto",48,y,10,BOLD,MUTED);y-=22;
                // Wrap by measured font width, including long words and untrusted description text.
                String value=seguro(t.getDescripcion()==null || t.getDescripcion().isBlank() ? "Sin concepto" : t.getDescripcion());
                StringBuilder line=new StringBuilder();
                for(char ch:value.toCharArray()) {
                    if(NORMAL.getStringWidth(line.toString()+ch)/1000*11>490) {
                        texto(c,line.toString(),48,y,11,NORMAL,NAVY);y-=17;line.setLength(0);
                    }
                    line.append(ch);
                }
                if(!line.isEmpty())texto(c,line.toString(),48,y,11,NORMAL,NAVY);
                if("REVERTIDA".equals(t.getEstado()))texto(c,"Este movimiento fue revertido. Consulte la operación compensatoria.",48,150,10,BOLD,BLUE);
                texto(c,"Emitido: "+LocalDateTime.now(ZoneId.of("America/Lima")).format(DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm:ss"))+" (Lima)",48,110,9,NORMAL,MUTED);
                texto(c,"Estado consultado al emitir. Conserve la referencia para futuras consultas.",48,92,9,NORMAL,MUTED);
                texto(c,"Documento de demostración académica. No es una constancia bancaria oficial.",48,74,9,NORMAL,MUTED);
            }
            doc.save(bytes);return bytes.toByteArray();
        }catch(IOException ex){throw new IllegalStateException("No se pudo generar el comprobante",ex);}
    }

    private String cuenta(String numero,Long id){return numero==null ? "Cuenta #"+id+" (número no disponible)" : numero;}
    private float fila(PDPageContentStream c,String label,String value,float y)throws IOException{
        texto(c,label,48,y,10,NORMAL,MUTED);texto(c,value,218,y,10,BOLD,NAVY);return y-33;
    }
    private void texto(PDPageContentStream c,String value,float x,float y,int size,PDType1Font font,Color color)throws IOException{
        c.beginText();c.setFont(font,size);c.setNonStrokingColor(color);c.newLineAtOffset(x,y);c.showText(seguro(value));c.endText();
    }
    private String seguro(String value){
        if(value==null)return "No disponible";
        StringBuilder text=new StringBuilder();
        value.codePoints().forEach(cp->{
            String s=Character.isISOControl(cp) ? " " : new String(Character.toChars(cp));
            try{NORMAL.encode(s);text.append(s);}catch(IOException|IllegalArgumentException ex){text.append('?');}
        });
        return text.toString();
    }
}
