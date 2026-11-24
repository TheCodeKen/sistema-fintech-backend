package com.fintech.msprestamos;
import com.fintech.msprestamos.client.*;
import com.fintech.msprestamos.entity.Prestamo;
import com.fintech.msprestamos.repository.*;
import com.fintech.msprestamos.service.*;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.*;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.server.ResponseStatusException;
import java.util.*;
import java.time.*;
import static org.mockito.Mockito.*;
import static org.junit.jupiter.api.Assertions.*;
@ExtendWith(MockitoExtension.class)
class PrestamoLifecycleTest {
    @Mock PrestamoRepository repository;
    @Mock PagoRepository pagos;
    @Mock UsuarioFeignClient usuarios;
    @Mock CuentaFeignClient cuentas;
    @Mock TransaccionFeignClient transacciones;
    @Mock CronogramaService cronograma;
    @Mock AuditoriaOutbox auditoria;
    @Mock NotificacionOutbox notificaciones;
    @Mock Clock reloj;
    @InjectMocks PrestamoService service;
    @BeforeEach void init() {
        autenticar(2L,"CLIENTE");
        lenient().when(reloj.instant()).thenReturn(Instant.parse("2027-01-31T17:00:00Z"));
        lenient().when(reloj.getZone()).thenReturn(ZoneId.of("America/Lima"));
        lenient().when(repository.save(any())).thenAnswer(i->i.getArgument(0));
    }
    @AfterEach void clear() {SecurityContextHolder.clearContext();}
    void autenticar(Long id,String role) {var a=new UsernamePasswordAuthenticationToken("prueba",null,List.of(new SimpleGrantedAuthority("ROLE_"+role)));a.setDetails(id);SecurityContextHolder.getContext().setAuthentication(a);}
    Prestamo prestamo(Prestamo.EstadoPrestamo e) {
        var p=Prestamo.builder().id(1L).usuarioId(2L).tipoPrestamo(Prestamo.TipoPrestamo.PERSONAL).estado(e).build();
        when(repository.bloquearPorId(1L)).thenReturn(Optional.of(p));return p;
    }
    @Test void clienteCancelaSolicitudPropiaConMotivoYAuditoria() {
        var p=prestamo(Prestamo.EstadoPrestamo.EN_REVISION);
        var response=service.cancelar(1L," Cambio de planes ");
        assertEquals("CANCELADO",response.getEstado());assertEquals("Cambio de planes",p.getMotivoCancelacion());assertNotNull(p.getFechaCancelacion());
        verify(auditoria).registrar(any());verifyNoInteractions(transacciones,cuentas);
        verify(notificaciones).registrar(eq("prestamo:1:CANCELADO"),eq(2L),eq("PRESTAMO_CANCELADO"),eq(1L),anyString(),anyString());
        service.cancelar(1L,"Otro motivo");verify(auditoria,times(1)).registrar(any());
    }
    @Test void clienteNoPuedeCancelarSolicitudAjena() {
        prestamo(Prestamo.EstadoPrestamo.PENDIENTE);autenticar(3L,"CLIENTE");
        assertEquals(403,assertThrows(ResponseStatusException.class,()->service.cancelar(1L,"Cambio de planes")).getStatusCode().value());
        verifyNoInteractions(auditoria,transacciones);
    }
    @Test void clienteNoCancelaAprobadoPeroAdministradorSiAntesDeDesembolso() {
        prestamo(Prestamo.EstadoPrestamo.APROBADO);
        assertEquals(409,assertThrows(ResponseStatusException.class,()->service.cancelar(1L,"Cambio de planes")).getStatusCode().value());
        autenticar(1L,"ADMIN");assertEquals("CANCELADO",service.cancelar(1L,"Decisión administrativa").getEstado());
    }
    @Test void noCancelaUnPrestamoYaDesembolsado() {
        prestamo(Prestamo.EstadoPrestamo.DESEMBOLSADO);autenticar(1L,"ADMIN");
        assertThrows(ResponseStatusException.class,()->service.cancelar(1L,"Cambio de planes"));verifyNoInteractions(transacciones,auditoria);
    }
    @Test void detalleAjenoNoMaterializaNiExponeCronograma() {
        prestamo(Prestamo.EstadoPrestamo.DESEMBOLSADO);autenticar(3L,"CLIENTE");
        assertThrows(ResponseStatusException.class,()->service.detalle(1L));verifyNoInteractions(cronograma);
    }
    @Test void procesoDeVencimientosNotificaSoloCuotasPendientesProximasOVencidas(){
        var p=prestamo(Prestamo.EstadoPrestamo.DESEMBOLSADO);p.setMoneda("PEN");p.setNumeroPrestamo("PRE1");
        var vencida=cuota(1,LocalDate.of(2027,1,30),false);
        var proxima=cuota(2,LocalDate.of(2027,2,2),false);
        var futura=cuota(3,LocalDate.of(2027,2,10),false);
        var pagada=cuota(4,LocalDate.of(2027,1,20),true);
        var plan=List.of(vencida,proxima,futura,pagada);
        when(cronograma.preparar(p)).thenReturn(plan);when(cronograma.estado(p,plan)).thenReturn(Prestamo.EstadoPrestamo.VENCIDO);
        service.actualizarVencimiento(1L);
        verify(notificaciones).registrar(eq("prestamo:1:cuota:1:CUOTA_VENCIDA"),eq(2L),eq("CUOTA_VENCIDA"),eq(1L),anyString(),contains("PEN 100.00"));
        verify(notificaciones).registrar(eq("prestamo:1:cuota:2:CUOTA_PROXIMA"),eq(2L),eq("CUOTA_PROXIMA"),eq(1L),anyString(),contains("02/02/2027"));
        verifyNoMoreInteractions(notificaciones);
    }
    private com.fintech.msprestamos.entity.CuotaPrestamo cuota(int numero,LocalDate fecha,boolean pagada){
        var c=new com.fintech.msprestamos.entity.CuotaPrestamo();c.setNumero(numero);c.setVencimiento(fecha);c.setImporte(new java.math.BigDecimal("100.00"));c.setPagado(pagada?c.getImporte():java.math.BigDecimal.ZERO);return c;
    }
}
