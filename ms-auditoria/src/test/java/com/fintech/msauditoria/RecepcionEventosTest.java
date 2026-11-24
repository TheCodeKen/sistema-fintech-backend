package com.fintech.msauditoria;

import com.fintech.msauditoria.dto.EventoAuditoria;
import com.fintech.msauditoria.service.RecepcionEventos;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.web.server.ResponseStatusException;
import java.time.LocalDateTime;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.*;

class RecepcionEventosTest {
    EventoAuditoria evento(String accion,LocalDateTime fecha) {
        return new EventoAuditoria("evento-prueba", "admin", "ADMIN",accion,"CUENTA",1L,"Detalle",fecha,null);
    }
    @Test void toleraLaPrecisionDeMicrosegundosDeMySQL() {
        var jdbc=mock(JdbcTemplate.class);
        var fecha=LocalDateTime.parse("2026-11-17T12:00:00.123456789");
        when(jdbc.queryForObject(anyString(),any(RowMapper.class),eq("evento-prueba")))
            .thenReturn(evento("ACTIVACION_CUENTA",fecha.withNano(123456000)));
        assertDoesNotThrow(()->new RecepcionEventos(jdbc).recibir(evento("ACTIVACION_CUENTA",fecha)));
    }
    @Test void rechazaIdentificadorReutilizadoConOtroContenido() {
        var jdbc=mock(JdbcTemplate.class);
        var fecha=LocalDateTime.parse("2026-11-17T12:00:00");
        when(jdbc.queryForObject(anyString(),any(RowMapper.class),eq("evento-prueba")))
            .thenReturn(evento("ACTIVACION_CUENTA",fecha));
        var ex=assertThrows(ResponseStatusException.class,()->new RecepcionEventos(jdbc).recibir(evento("CIERRE_CUENTA",fecha)));
        assertEquals(409,ex.getStatusCode().value());
    }
}
