package com.fintech.msprestamos.service;

import com.fintech.msprestamos.config.security.Acceso;
import com.fintech.msprestamos.dto.EvaluacionClienteResponse;
import com.fintech.msprestamos.dto.PrestamoResponse;
import com.fintech.msprestamos.repository.PrestamoRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import java.math.BigDecimal;
import java.time.Clock;
import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.List;

@Service
@RequiredArgsConstructor
public class EvaluacionClienteService {
    private final PrestamoRepository prestamos;
    private final JdbcTemplate jdbc;
    private final Clock reloj;

    @Transactional(readOnly=true)
    public EvaluacionClienteResponse consultar(Long solicitudId, int pagina) {
        if (!Acceso.admin()) throw new ResponseStatusException(HttpStatus.FORBIDDEN);
        if (pagina<0 || (long)pagina*20>Integer.MAX_VALUE) throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Página no válida");
        var solicitud=prestamos.findById(solicitudId)
                .orElseThrow(()->new ResponseStatusException(HttpStatus.NOT_FOUND,"Solicitud no encontrada"));
        Long usuario=solicitud.getUsuarioId();
        LocalDate hoy=LocalDate.now(reloj);
        var estados=new LinkedHashMap<String,Long>();
        jdbc.query("SELECT estado, COUNT(*) AS total FROM prestamos WHERE usuario_id=? AND id<>? GROUP BY estado",
                rs->{estados.put(rs.getString("estado"),rs.getLong("total"));},usuario,solicitudId);
        var vencidos=jdbc.query("""
                SELECT p.moneda, COUNT(*) AS cuotas, SUM(c.importe-c.pagado) AS saldo, MIN(c.vencimiento) AS primera
                FROM cuotas_prestamo c JOIN prestamos p ON p.id=c.prestamo_id
                WHERE p.usuario_id=? AND p.id<>? AND p.estado IN ('DESEMBOLSADO','VENCIDO')
                    AND c.vencimiento<? AND c.pagado<c.importe GROUP BY p.moneda
                """,(rs,n)->new EvaluacionClienteResponse.ResumenMoneda(rs.getString("moneda"),0,BigDecimal.ZERO,
                    BigDecimal.ZERO,rs.getLong("cuotas"),rs.getBigDecimal("saldo"),rs.getDate("primera").toLocalDate()),usuario,solicitudId,hoy);
        List<EvaluacionClienteResponse.ResumenMoneda> saldos=jdbc.query("""
                SELECT moneda, COUNT(*) AS vigentes, SUM(saldo_pendiente) AS saldo, SUM(cuota_mensual) AS cuota
                FROM prestamos WHERE usuario_id=? AND id<>? AND estado IN ('DESEMBOLSADO','VENCIDO') GROUP BY moneda
                """,(rs,n)->{
                    String moneda=rs.getString("moneda");
                    var vencido=vencidos.stream().filter(v->java.util.Objects.equals(v.moneda(),moneda)).findFirst();
                    return new EvaluacionClienteResponse.ResumenMoneda(moneda,rs.getLong("vigentes"),rs.getBigDecimal("saldo"),
                        rs.getBigDecimal("cuota"),vencido.map(v->v.cuotasVencidas()).orElse(0L),
                        vencido.map(v->v.saldoVencido()).orElse(BigDecimal.ZERO),vencido.map(v->v.primerVencimiento()).orElse(null));
                },usuario,solicitudId);
        Long incompletos=jdbc.queryForObject("""
                SELECT COUNT(*) FROM prestamos p WHERE p.usuario_id=? AND p.id<>?
                    AND p.estado IN ('DESEMBOLSADO','VENCIDO')
                    AND (SELECT COUNT(*) FROM cuotas_prestamo c WHERE c.prestamo_id=p.id) <> p.plazo_meses
                """,Long.class,usuario,solicitudId);
        var paginaHistorial=prestamos.findByUsuarioIdAndIdNot(usuario,solicitudId,
                PageRequest.of(pagina,20,Sort.by(Sort.Order.desc("fechaSolicitud"),Sort.Order.desc("id"))));
        var recientes=paginaHistorial.stream().map(PrestamoResponse::from).toList();
        Long totalPagos=jdbc.queryForObject("""
                SELECT COUNT(*) FROM pagos_aplicados a JOIN prestamos p ON p.id=a.prestamo_id
                WHERE p.usuario_id=? AND p.id<>? AND a.monto IS NOT NULL
                """,Long.class,usuario,solicitudId);
        var pagos=jdbc.query("""
                SELECT p.id,p.numero_prestamo,p.moneda,a.monto,a.fecha_pago,a.transaccion_id
                FROM pagos_aplicados a JOIN prestamos p ON p.id=a.prestamo_id
                WHERE p.usuario_id=? AND p.id<>? AND a.monto IS NOT NULL
                ORDER BY a.fecha_pago IS NULL, a.fecha_pago DESC, a.clave DESC LIMIT 10
                """,(rs,n)->new EvaluacionClienteResponse.Pago(rs.getLong("id"),rs.getString("numero_prestamo"),rs.getString("moneda"),
                    rs.getBigDecimal("monto"),rs.getTimestamp("fecha_pago")==null?null:rs.getTimestamp("fecha_pago").toLocalDateTime(),
                    (Long)rs.getObject("transaccion_id")),usuario,solicitudId);
        return new EvaluacionClienteResponse(PrestamoResponse.from(solicitud),hoy,
                estados.values().stream().mapToLong(Long::longValue).sum(),estados,saldos,incompletos,recientes,
                pagina,paginaHistorial.getTotalPages(),totalPagos,pagos);
    }
}
