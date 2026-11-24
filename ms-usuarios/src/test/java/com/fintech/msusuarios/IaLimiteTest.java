package com.fintech.msusuarios;
import com.fintech.msusuarios.ia.IaLimite;
import org.junit.jupiter.api.Test;
import org.springframework.web.server.ResponseStatusException;
import static org.junit.jupiter.api.Assertions.*;
class IaLimiteTest {
    @Test void limitaConsultasPorUsuarioYLiberaAlTerminar()throws Exception{
        var l=new IaLimite();var first=l.iniciar(1L);assertEquals(429,assertThrows(ResponseStatusException.class,()->l.iniciar(1L)).getStatusCode().value());first.close();
        for(int n=1;n<6;n++)l.iniciar(1L).close();assertThrows(ResponseStatusException.class,()->l.iniciar(1L));
    }
    @Test void limitaConcurrenciaGlobalYRecuperaCupos()throws Exception{
        var l=new IaLimite();var a=l.iniciar(1L);var b=l.iniciar(2L);var c=l.iniciar(3L);var d=l.iniciar(4L);
        assertThrows(ResponseStatusException.class,()->l.iniciar(5L));a.close();l.iniciar(5L).close();b.close();c.close();d.close();
    }
}
