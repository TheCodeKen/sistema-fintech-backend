package com.fintech.mstransacciones;

import com.fintech.mstransacciones.client.*;
import com.fintech.mstransacciones.dto.*;
import com.fintech.mstransacciones.entity.Transaccion;
import com.fintech.mstransacciones.repository.TransaccionRepository;
import com.fintech.mstransacciones.service.*;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.*;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.server.ResponseStatusException;
import java.math.BigDecimal;
import java.util.*;
import static org.mockito.Mockito.*;
import static org.junit.jupiter.api.Assertions.*;

@ExtendWith(MockitoExtension.class)
class NotificacionMovimientoTest {
    @Mock TransaccionRepository repository;
    @Mock CuentaFeignClient cuentas;
    @Mock AuditoriaOutbox auditoria;
    @Mock AntifraudeService antifraude;
    @Mock NotificacionOutbox notificaciones;
    @InjectMocks TransaccionService service;
    @BeforeEach void init(){
        var a=new UsernamePasswordAuthenticationToken("cliente",null,List.of(new SimpleGrantedAuthority("ROLE_CLIENTE")));a.setDetails(2L);SecurityContextHolder.getContext().setAuthentication(a);
        lenient().when(repository.save(any())).thenAnswer(inv->{Transaccion tx=inv.getArgument(0);tx.setId(100L);tx.setNumeroReferencia("TXN100");return tx;});
    }
    @AfterEach void clear(){SecurityContextHolder.clearContext();}
    CuentaClientDTO cuenta(long id,long usuario,String numero){var c=new CuentaClientDTO();c.setId(id);c.setUsuarioId(usuario);c.setNumeroCuenta(numero);c.setEstado("ACTIVA");c.setMoneda("PEN");c.setSaldo(new BigDecimal("100.00"));return c;}
    TransaccionRequest solicitud(long destinatario){
        var origen=cuenta(1,2,"FT12345678");var destino=cuenta(3,destinatario,"FT87654321");
        when(cuentas.obtenerCuentaPorNumero("FT12345678")).thenReturn(origen);when(cuentas.obtenerCuentaPorNumero("FT87654321")).thenReturn(destino);
        lenient().when(cuentas.obtenerCuentaPorId(1L)).thenReturn(origen);lenient().when(cuentas.obtenerCuentaPorId(3L)).thenReturn(destino);
        var r=new TransaccionRequest();r.setNumeroCuentaOrigen("FT12345678");r.setNumeroCuentaDestino("FT87654321");r.setTipoTransaccion(Transaccion.TipoTransaccion.TRANSFERENCIA);r.setMonto(new BigDecimal("10.00"));r.setOperacionId("aviso-operacion-100");return r;
    }
    @Test void transferenciaNotificaAOrigenYDestinatario(){
        service.crear(solicitud(4));
        verify(notificaciones).registrar(eq("tx:100:2"),eq(2L),eq("MOVIMIENTO_CONFIRMADO"),eq(100L),eq("Transferencia enviada"),contains("PEN 10.00"));
        verify(notificaciones).registrar(eq("tx:100:4"),eq(4L),eq("MOVIMIENTO_CONFIRMADO"),eq(100L),eq("Transferencia recibida"),contains("TXN100"));verifyNoMoreInteractions(notificaciones);
    }
    @Test void transferenciaEntreCuentasPropiasTieneUnSoloAviso(){
        service.crear(solicitud(2));
        verify(notificaciones).registrar(eq("tx:100:2"),eq(2L),anyString(),eq(100L),eq("Transferencia entre tus cuentas"),anyString());verifyNoMoreInteractions(notificaciones);
    }
    @Test void resultadoRemotoInciertoNoEmiteConfirmacion(){
        var r=solicitud(4);
        doThrow(feign.FeignException.errorStatus("aplicar",feign.Response.builder().status(503).reason("Unavailable").headers(Map.of()).request(feign.Request.create(feign.Request.HttpMethod.POST,"http://cuentas",Map.of(),new byte[0],java.nio.charset.StandardCharsets.UTF_8,null)).build())).when(cuentas).aplicar(any());
        assertThrows(ResponseStatusException.class,()->service.crear(r));verifyNoInteractions(notificaciones);
    }
}
