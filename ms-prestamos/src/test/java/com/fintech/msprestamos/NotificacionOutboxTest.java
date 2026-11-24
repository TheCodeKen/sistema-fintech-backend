package com.fintech.msprestamos;
import com.fintech.msprestamos.entity.AvisoPendiente;
import com.fintech.msprestamos.repository.AvisoPendienteRepository;
import com.fintech.msprestamos.service.NotificacionOutbox;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.*;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;
import com.sun.net.httpserver.HttpServer;
import java.net.InetSocketAddress;
import java.time.LocalDateTime;
import java.util.List;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;
import static org.mockito.Mockito.*;
import static org.junit.jupiter.api.Assertions.*;
@ExtendWith(MockitoExtension.class)
class NotificacionOutboxTest {
    @Mock AvisoPendienteRepository repository;
    @InjectMocks NotificacionOutbox service;
    @Test void reintentaEntregaSinPerderAvisoYUsaSoloCredencialInterna()throws Exception{
        var e=new AvisoPendiente();e.setClave("tx:1:2");e.setUsuarioId(2L);e.setTipo("MOVIMIENTO_CONFIRMADO");e.setRecursoId(1L);e.setTitulo("Confirmado");e.setMensaje("PEN 10.00");e.setFechaEvento(LocalDateTime.of(2026,11,14,10,0));
        when(repository.findTop50ByFechaEntregaIsNullOrderByFechaEventoAscClaveAsc()).thenReturn(List.of(e));
        var status=new AtomicInteger(503);var body=new AtomicReference<String>();var authorization=new AtomicReference<String>();var key=new AtomicReference<String>();
        var server=HttpServer.create(new InetSocketAddress("127.0.0.1",0),0);
        server.createContext("/api/usuarios/notificaciones/internal/eventos",exchange->{
            body.set(new String(exchange.getRequestBody().readAllBytes(),java.nio.charset.StandardCharsets.UTF_8));
            authorization.set(exchange.getRequestHeaders().getFirst("Authorization"));key.set(exchange.getRequestHeaders().getFirst("X-Internal-Service"));
            exchange.sendResponseHeaders(status.get(),-1);exchange.close();
        });server.start();
        try{
            ReflectionTestUtils.setField(service,"url","http://127.0.0.1:"+server.getAddress().getPort());ReflectionTestUtils.setField(service,"key","clave-prueba");
            service.publicar();verify(repository,never()).entregado(anyString(),any());
            status.set(204);service.publicar();verify(repository,times(1)).entregado(eq("tx:1:2"),any());
            assertNull(authorization.get());assertEquals("clave-prueba",key.get());assertTrue(body.get().contains("tx:1:2"));assertTrue(body.get().contains("MOVIMIENTO_CONFIRMADO"));
        }finally{server.stop(0);}
    }
}
