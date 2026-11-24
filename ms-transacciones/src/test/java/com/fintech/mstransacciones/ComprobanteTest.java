package com.fintech.mstransacciones;

import com.fintech.mstransacciones.dto.*;
import com.fintech.mstransacciones.service.ComprobanteService;
import org.apache.pdfbox.Loader;
import org.apache.pdfbox.rendering.PDFRenderer;
import org.apache.pdfbox.text.PDFTextStripper;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.web.server.ResponseStatusException;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.nio.file.*;
import javax.imageio.ImageIO;
import static org.junit.jupiter.api.Assertions.*;

class ComprobanteTest {
    private final ComprobanteService service=new ComprobanteService();
    TransaccionDetalle detalle(String estado){
        var tx=TransaccionResponse.builder().id(1L).cuentaOrigenId(2L).cuentaDestinoId(3L)
                .numeroCuentaOrigen("FT12345678").numeroCuentaDestino("FT87654321").monto(new BigDecimal("150.25")).moneda("PEN")
                .estado(estado).tipoTransaccion("TRANSFERENCIA").numeroReferencia("TXN1234567890abcdefghijklmn")
                .fechaTransaccion(LocalDateTime.of(2026,11,14,8,30)).descripcion("Transferencia: inscripción y matrícula. "+"Concepto largo ".repeat(12)+" 📄").build();
        return new TransaccionDetalle(tx,null,null);
    }
    @Test void generaPdfLegibleConAcentosImporteYCuenta()throws Exception{
        byte[] pdf=service.generar(detalle("COMPLETADA"));
        try(var doc=Loader.loadPDF(pdf)){
            assertEquals(1,doc.getNumberOfPages());String text=new PDFTextStripper().getText(doc);
            assertTrue(text.contains("PEN 150.25"));assertTrue(text.contains("FT87654321"));assertTrue(text.contains("matrícula"));assertTrue(text.contains("COMPLETADA"));
            Path dir=Path.of("target","receipt-verification");Files.createDirectories(dir);Files.write(dir.resolve("comprobante.pdf"),pdf);
            ImageIO.write(new PDFRenderer(doc).renderImageWithDPI(0,110),"png",dir.resolve("comprobante.png").toFile());
        }
    }
    @Test void comprobanteRevertidoDeclaraSuEstadoYReferenciaCompensatoria()throws Exception{
        var d=detalle("REVERTIDA");var r=TransaccionResponse.builder().numeroReferencia("REV-123").build();
        try(var doc=Loader.loadPDF(service.generar(new TransaccionDetalle(d.movimiento(),null,r)))){
            String text=new PDFTextStripper().getText(doc);assertTrue(text.contains("fue revertido"));assertTrue(text.contains("REV-123"));
        }
    }
    @ParameterizedTest @ValueSource(strings={"PENDIENTE","PROCESANDO","FALLIDA","CANCELADA"})
    void noEmiteConstanciaDeExitoParaEstadosNoConfirmados(String estado){
        assertEquals(409,assertThrows(ResponseStatusException.class,()->service.generar(detalle(estado))).getStatusCode().value());
    }
}
