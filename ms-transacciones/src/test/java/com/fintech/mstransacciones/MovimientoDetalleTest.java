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
class MovimientoDetalleTest {
    @Mock TransaccionRepository repository;
    @Mock CuentaFeignClient cuentas;
    @Mock AuditoriaOutbox auditoria;
    @Mock NotificacionOutbox notificaciones;
    @Mock AntifraudeService antifraude;
    @InjectMocks TransaccionService service;
    @BeforeEach void init(){
        var auth=new UsernamePasswordAuthenticationToken("cliente",null,List.of(new SimpleGrantedAuthority("ROLE_CLIENTE")));
        auth.setDetails(2L);SecurityContextHolder.getContext().setAuthentication(auth);
    }
    @AfterEach void clear(){SecurityContextHolder.clearContext();}
    CuentaClientDTO cuenta(Long id,Long usuario,String moneda){
        var c=new CuentaClientDTO();c.setId(id);c.setUsuarioId(usuario);c.setNumeroCuenta(id==1 ? "FT12345678" : "FT87654321");
        c.setEstado("ACTIVA");c.setMoneda(moneda);c.setSaldo(new BigDecimal("100.00"));return c;
    }
    TransaccionRequest solicitud(){
        var r=new TransaccionRequest();r.setCuentaOrigenId(1L);r.setNumeroCuentaDestino("FT87654321");
        r.setTipoTransaccion(Transaccion.TipoTransaccion.TRANSFERENCIA);r.setMonto(new BigDecimal("10.00"));r.setMoneda("PEN");return r;
    }
    @Test void revisionValidaDestinoSinExponerSuSaldoNiCrearMovimientos(){
        when(cuentas.obtenerCuentaPorId(1L)).thenReturn(cuenta(1L,2L,"PEN"));
        when(cuentas.obtenerCuentaPorNumero("FT87654321")).thenReturn(cuenta(3L,99L,"PEN"));
        var result=service.revisar(solicitud());
        assertEquals("FT87654321",result.numeroCuentaDestino());assertEquals(new BigDecimal("90.00"),result.saldoEstimado());
        verifyNoInteractions(repository,auditoria,antifraude);verify(cuentas,never()).aplicar(any());
    }
    @Test void revisionAjenaSeRechazaAntesDeConsultarDestino(){
        when(cuentas.obtenerCuentaPorId(1L)).thenReturn(cuenta(1L,99L,"PEN"));
        assertEquals(403,assertThrows(ResponseStatusException.class,()->service.revisar(solicitud())).getStatusCode().value());
        verify(cuentas,never()).obtenerCuentaPorNumero(any());verifyNoInteractions(repository);
    }
    @Test void revisionRechazaMonedaDiferente(){
        when(cuentas.obtenerCuentaPorId(1L)).thenReturn(cuenta(1L,2L,"PEN"));
        when(cuentas.obtenerCuentaPorNumero("FT87654321")).thenReturn(cuenta(3L,99L,"USD"));
        assertEquals(400,assertThrows(ResponseStatusException.class,()->service.revisar(solicitud())).getStatusCode().value());
        verify(cuentas,never()).aplicar(any());
    }
    @Test void revisionRechazaDestinoBloqueado(){
        when(cuentas.obtenerCuentaPorId(1L)).thenReturn(cuenta(1L,2L,"PEN"));
        var destino=cuenta(3L,99L,"PEN");destino.setEstado("BLOQUEADA");when(cuentas.obtenerCuentaPorNumero("FT87654321")).thenReturn(destino);
        assertEquals(409,assertThrows(ResponseStatusException.class,()->service.revisar(solicitud())).getStatusCode().value());
    }
    @Test void revisionRechazaSaldoInsuficiente(){
        when(cuentas.obtenerCuentaPorId(1L)).thenReturn(cuenta(1L,2L,"PEN"));
        var r=solicitud();r.setTipoTransaccion(Transaccion.TipoTransaccion.RETIRO);r.setMonto(new BigDecimal("101.00"));
        assertEquals(409,assertThrows(ResponseStatusException.class,()->service.revisar(r)).getStatusCode().value());
    }
    @Test void revisionNoPermiteTiposInternos(){
        var r=solicitud();r.setTipoTransaccion(Transaccion.TipoTransaccion.DESEMBOLSO_PRESTAMO);
        assertThrows(ResponseStatusException.class,()->service.revisar(r));verifyNoInteractions(cuentas,repository);
    }
    @Test void detalleAjenoNoConsultaRelaciones(){
        var tx=Transaccion.builder().id(8L).cuentaOrigenId(1L).tipoTransaccion(Transaccion.TipoTransaccion.RETIRO).estado(Transaccion.EstadoTransaccion.COMPLETADA).build();
        when(repository.findById(8L)).thenReturn(Optional.of(tx));when(cuentas.obtenerCuentaPorId(1L)).thenReturn(cuenta(1L,99L,"PEN"));
        assertEquals(403,assertThrows(ResponseStatusException.class,()->service.detalle(8L)).getStatusCode().value());
        verify(repository,never()).findFirstByTransaccionPadreIdAndTipoTransaccion(any(),any());
    }
    @Test void destinatarioPuedeConsultarDetalleYReversion(){
        var tx=Transaccion.builder().id(8L).cuentaOrigenId(1L).cuentaDestinoId(3L).tipoTransaccion(Transaccion.TipoTransaccion.TRANSFERENCIA).estado(Transaccion.EstadoTransaccion.REVERTIDA).build();
        var rev=Transaccion.builder().id(9L).cuentaOrigenId(1L).cuentaDestinoId(3L).transaccionPadreId(8L).tipoTransaccion(Transaccion.TipoTransaccion.REVERSION).estado(Transaccion.EstadoTransaccion.COMPLETADA).build();
        when(repository.findById(8L)).thenReturn(Optional.of(tx));when(cuentas.obtenerCuentaPorId(1L)).thenReturn(cuenta(1L,99L,"PEN"));when(cuentas.obtenerCuentaPorId(3L)).thenReturn(cuenta(3L,2L,"PEN"));
        when(repository.findFirstByTransaccionPadreIdAndTipoTransaccion(8L,Transaccion.TipoTransaccion.REVERSION)).thenReturn(Optional.of(rev));
        var detail=service.detalle(8L);assertEquals(9L,detail.reversion().getId());assertEquals("REVERTIDA",detail.movimiento().getEstado());
    }
}
