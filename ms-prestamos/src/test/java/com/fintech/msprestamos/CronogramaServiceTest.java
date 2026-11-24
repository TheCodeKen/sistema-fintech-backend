package com.fintech.msprestamos;
import com.fintech.msprestamos.entity.*;
import com.fintech.msprestamos.repository.*;
import com.fintech.msprestamos.service.CronogramaService;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.*;
import org.mockito.junit.jupiter.MockitoExtension;
import java.time.*;
import java.math.BigDecimal;
import java.util.*;
import static org.mockito.Mockito.*;
import static org.junit.jupiter.api.Assertions.*;

@ExtendWith(MockitoExtension.class)
class CronogramaServiceTest {
    @Mock CuotaRepository cuotas;
    @Mock PagoRepository pagos;
    CronogramaService service;
    @BeforeEach void init() {service=new CronogramaService(cuotas,pagos,Clock.fixed(Instant.parse("2027-02-28T17:00:00Z"),ZoneId.of("America/Lima")));}
    Prestamo prestamo(String saldo) {return Prestamo.builder().id(1L).numeroPrestamo("PRE1").usuarioId(2L)
            .estado(Prestamo.EstadoPrestamo.DESEMBOLSADO).saldoPendiente(new BigDecimal(saldo)).plazoMeses(3)
            .fechaDesembolso(LocalDate.of(2027,1,31)).fechaVencimiento(LocalDate.of(2027,4,30)).moneda("PEN")
            .tipoPrestamo(Prestamo.TipoPrestamo.PERSONAL).build();}
    List<CuotaPrestamo> generar(Prestamo p) {
        when(cuotas.saveAll(anyList())).thenAnswer(i->i.getArgument(0));
        return service.preparar(p);
    }
    @Test void calendarioDeFinDeMesConservaCentimosYFechaAncla() {
        var p=prestamo("100.01");var plan=generar(p);
        assertEquals(List.of(LocalDate.of(2027,2,28),LocalDate.of(2027,3,31),LocalDate.of(2027,4,30)),plan.stream().map(CuotaPrestamo::getVencimiento).toList());
        assertEquals(new BigDecimal("33.35"),plan.get(2).getImporte());
        assertEquals(new BigDecimal("100.01"),plan.stream().map(CuotaPrestamo::getImporte).reduce(BigDecimal.ZERO,BigDecimal::add));
        assertEquals(Prestamo.EstadoPrestamo.DESEMBOLSADO,service.estado(p,plan));
    }
    @Test void pagoParcialCubrePrimeroLaCuotaMasAntigua() {
        var p=prestamo("300.00");var plan=generar(p);service.aplicar(plan,new BigDecimal("150.00"));
        assertEquals(new BigDecimal("100.00"),plan.get(0).getPagado());
        assertEquals(new BigDecimal("50.00"),plan.get(1).getPagado());
        assertEquals(new BigDecimal("0"),plan.get(2).getPagado());
        p.setSaldoPendiente(new BigDecimal("150.00"));service.validarSaldo(p,plan);
    }
    @Test void cuotaVenceAlDiaSiguienteYRegularizarRestauraEstado() {
        var p=prestamo("300.00");var plan=generar(p);
        var siguiente=new CronogramaService(cuotas,pagos,Clock.fixed(Instant.parse("2027-03-01T17:00:00Z"),ZoneId.of("America/Lima")));
        assertEquals(Prestamo.EstadoPrestamo.VENCIDO,siguiente.estado(p,plan));
        service.aplicar(plan,new BigDecimal("100.00"));p.setSaldoPendiente(new BigDecimal("200.00"));p.setEstado(Prestamo.EstadoPrestamo.VENCIDO);
        assertEquals(Prestamo.EstadoPrestamo.DESEMBOLSADO,siguiente.estado(p,plan));
        service.aplicar(plan,new BigDecimal("200.00"));p.setSaldoPendiente(BigDecimal.ZERO);
        assertEquals(Prestamo.EstadoPrestamo.PAGADO,siguiente.estado(p,plan));
    }
    @Test void datosHistoricosReconstruyenDeudaSinInventarFechaDelPago() {
        var p=prestamo("80.00");p.setFechaDesembolso(null);
        var h=new PagoAplicado("prestamo:1:pago:old","1:20.01");h.setMonto(new BigDecimal("20.01"));h.setCuentaId(1L);
        when(pagos.findByPrestamoIdOrderByFechaPagoAscClaveAsc(1L)).thenReturn(List.of(h));
        var plan=generar(p);var d=service.detalle(p,plan);
        assertEquals(new BigDecimal("100.01"),d.totalPactado());
        assertEquals(new BigDecimal("20.01"),d.totalPagado());
        assertNull(d.pagos().get(0).fechaPago());assertTrue(d.pagos().get(0).historico());assertNotNull(d.advertencia());
        service.validarSaldo(p,plan);
    }
    @Test void noRegeneraUnPlanYaPersistido() {
        var c=new CuotaPrestamo();when(cuotas.findByPrestamoIdOrderByNumeroAsc(1L)).thenReturn(List.of(c));
        assertSame(c,service.preparar(prestamo("100.00")).get(0));verify(cuotas,never()).saveAll(any());
    }
    @Test void rechazaCronogramaNoConciliado() {
        var p=prestamo("300.00");var plan=generar(p);p.setSaldoPendiente(new BigDecimal("299.00"));
        assertThrows(org.springframework.web.server.ResponseStatusException.class,()->service.validarSaldo(p,plan));
    }
}
