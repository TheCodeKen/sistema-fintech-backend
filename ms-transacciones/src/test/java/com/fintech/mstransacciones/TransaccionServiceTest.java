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
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
@ExtendWith(MockitoExtension.class)
class TransaccionServiceTest {
    @Mock TransaccionRepository repository;
    @Mock CuentaFeignClient cuentas;
    @Mock AuditoriaOutbox auditoria;
    @Mock NotificacionOutbox notificaciones;
    @Mock AntifraudeService antifraude;
    @InjectMocks TransaccionService service;
    @BeforeEach void cliente() {
        var auth=new UsernamePasswordAuthenticationToken("cliente",null,List.of(new SimpleGrantedAuthority("ROLE_CLIENTE")));
        auth.setDetails(2L);SecurityContextHolder.getContext().setAuthentication(auth);
    }
    @AfterEach void limpiar() { SecurityContextHolder.clearContext(); }
    TransaccionRequest request(Transaccion.TipoTransaccion tipo) {
        var r=new TransaccionRequest();r.setOperacionId("operacion-prueba-1");r.setCuentaOrigenId(1L);
        r.setTipoTransaccion(tipo);r.setMonto(new BigDecimal("10.00"));return r;
    }
    @Test void clienteNoPuedeCrearDesembolsoDirecto() {
        assertThrows(ResponseStatusException.class,()->service.crear(request(Transaccion.TipoTransaccion.DESEMBOLSO_PRESTAMO)));
        verifyNoInteractions(cuentas,repository);
    }
    @Test void clienteNoPuedeDebitarCuentaAjena() {
        var c=new CuentaClientDTO();c.setId(1L);c.setUsuarioId(99L);
        when(cuentas.obtenerCuentaPorId(1L)).thenReturn(c);
        assertThrows(ResponseStatusException.class,()->service.crear(request(Transaccion.TipoTransaccion.RETIRO)));
        verify(cuentas,never()).aplicar(any());
    }
    @Test void reversionNoPuedeRevertirse() {
        var t=Transaccion.builder().id(1L).tipoTransaccion(Transaccion.TipoTransaccion.REVERSION).estado(Transaccion.EstadoTransaccion.COMPLETADA).build();
        when(repository.bloquearPorId(1L)).thenReturn(Optional.of(t));
        assertThrows(ResponseStatusException.class,()->service.revertir(1L));
        verifyNoInteractions(cuentas);
    }
    @Test void pagoPrestamoNoAdmiteReversionIndependiente() {
        var t=Transaccion.builder().id(1L).tipoTransaccion(Transaccion.TipoTransaccion.PAGO_PRESTAMO).estado(Transaccion.EstadoTransaccion.COMPLETADA).build();
        when(repository.bloquearPorId(1L)).thenReturn(Optional.of(t));
        assertThrows(ResponseStatusException.class,()->service.revertir(1L));
        verifyNoInteractions(cuentas);
    }
    @Test void reintentarOriginalRevertidaNoVuelveACompletadaNiAplicaFondos() {
        var request=request(Transaccion.TipoTransaccion.RETIRO);
        String huella=org.springframework.test.util.ReflectionTestUtils.invokeMethod(service,"huella",request);
        var tx=Transaccion.builder().id(1L).cuentaOrigenId(1L).tipoTransaccion(Transaccion.TipoTransaccion.RETIRO)
                .estado(Transaccion.EstadoTransaccion.REVERTIDA).huella(huella).build();
        when(repository.findByOperacionId("usuario:2:operacion-prueba-1")).thenReturn(Optional.of(tx));
        var cuenta=new CuentaClientDTO();cuenta.setUsuarioId(2L);
        when(cuentas.obtenerCuentaPorId(1L)).thenReturn(cuenta);
        assertEquals("REVERTIDA",service.crear(request).getEstado());
        verify(cuentas,never()).aplicar(any());verify(repository,never()).save(any());
    }
}
