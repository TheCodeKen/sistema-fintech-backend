package com.fintech.mscuentas;

import com.fintech.mscuentas.dto.MovimientoRequest;
import com.fintech.mscuentas.entity.*;
import com.fintech.mscuentas.repository.*;
import com.fintech.mscuentas.service.MovimientoService;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.*;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.web.context.request.*;
import org.springframework.web.server.ResponseStatusException;
import java.math.BigDecimal;
import java.util.Optional;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class MovimientoServiceTest {
    @Mock CuentaRepository cuentas;
    @Mock MovimientoRepository movimientos;
    @InjectMocks MovimientoService service;
    @BeforeEach void interno() {
        var request=new MockHttpServletRequest();
        request.setAttribute("servicioInterno",true);
        RequestContextHolder.setRequestAttributes(new ServletRequestAttributes(request));
    }
    @AfterEach void limpiar() { RequestContextHolder.resetRequestAttributes(); }
    Cuenta cuenta(long id,String saldo) {
        return Cuenta.builder().id(id).usuarioId(id).moneda("PEN").estado(Cuenta.EstadoCuenta.ACTIVA).saldo(new BigDecimal(saldo)).build();
    }
    @Test void transferenciaValidaActualizaAmbosSaldos() {
        var origen=cuenta(2,"100.00"); var destino=cuenta(1,"10.00");
        when(cuentas.bloquearPorId(1L)).thenReturn(Optional.of(destino));
        when(cuentas.bloquearPorId(2L)).thenReturn(Optional.of(origen));
        service.aplicar(new MovimientoRequest("transferencia-1",2L,1L,new BigDecimal("-30.00"),"PEN"));
        assertEquals(new BigDecimal("70.00"),origen.getSaldo());
        assertEquals(new BigDecimal("40.00"),destino.getSaldo());
        var order=inOrder(cuentas);order.verify(cuentas).bloquearPorId(1L);order.verify(cuentas).bloquearPorId(2L);
        verify(movimientos).save(any());
    }
    @Test void destinoBloqueadoNoModificaNingunSaldo() {
        var origen=cuenta(1,"100.00"); var destino=cuenta(2,"10.00");
        destino.setEstado(Cuenta.EstadoCuenta.BLOQUEADA);
        when(cuentas.bloquearPorId(1L)).thenReturn(Optional.of(origen));
        when(cuentas.bloquearPorId(2L)).thenReturn(Optional.of(destino));
        assertThrows(ResponseStatusException.class,()->service.aplicar(new MovimientoRequest("transferencia-1",1L,2L,new BigDecimal("-30"),"PEN")));
        assertEquals(new BigDecimal("100.00"),origen.getSaldo());
        assertEquals(new BigDecimal("10.00"),destino.getSaldo());
        verify(movimientos,never()).save(any());
    }
    @Test void reintentoMismaClaveNoDuplicaDebito() {
        var origen=cuenta(1,"70.00");
        when(cuentas.bloquearPorId(1L)).thenReturn(Optional.of(origen));
        when(movimientos.findById("retiro-1")).thenReturn(Optional.of(new MovimientoAplicado("retiro-1","1:null:-30:PEN")));
        service.aplicar(new MovimientoRequest("retiro-1",1L,null,new BigDecimal("-30.00"),"PEN"));
        assertEquals(new BigDecimal("70.00"),origen.getSaldo());
        verify(movimientos,never()).save(any());
    }
    @Test void claveReutilizadaConOtroMontoEsRechazada() {
        when(cuentas.bloquearPorId(1L)).thenReturn(Optional.of(cuenta(1,"70.00")));
        when(movimientos.findById("retiro-1")).thenReturn(Optional.of(new MovimientoAplicado("retiro-1","1:null:-30:PEN")));
        assertThrows(ResponseStatusException.class,()->service.aplicar(new MovimientoRequest("retiro-1",1L,null,new BigDecimal("-50"),"PEN")));
    }
    @Test void peticionPublicaNoPuedeAplicarSaldo() {
        RequestContextHolder.resetRequestAttributes();
        assertThrows(ResponseStatusException.class,()->service.aplicar(new MovimientoRequest("retiro-1",1L,null,new BigDecimal("-30"),"PEN")));
        verifyNoInteractions(cuentas,movimientos);
    }
}
