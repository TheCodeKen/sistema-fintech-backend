package com.fintech.mstransacciones.controller;
import com.fintech.mstransacciones.dto.TransaccionesMetricasResponse;
import com.fintech.mstransacciones.entity.Transaccion.EstadoTransaccion;
import com.fintech.mstransacciones.repository.TransaccionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.Map;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/transacciones/metricas")
@RequiredArgsConstructor
public class MetricasController {
    private final TransaccionRepository repository;
    @GetMapping
    public ResponseEntity<TransaccionesMetricasResponse> obtener() {
        LocalDateTime desde = java.time.LocalDate.now(ZoneId.of("America/Lima")).atStartOfDay();
        LocalDateTime hasta = desde.plusDays(1);
        Map<String, Long> tipos = repository.contarTipos(desde, hasta).stream()
                .collect(Collectors.toMap(row -> ((Enum<?>) row[0]).name(),
                        row -> ((Number) row[1]).longValue()));
        return ResponseEntity.ok(TransaccionesMetricasResponse.builder()
                .montoHoy(valor(repository.sumMontoHoy(desde, hasta, EstadoTransaccion.COMPLETADA)))
                .cantidadHoy(repository.countEntre(desde, hasta))
                .porTipo(tipos).build());
    }
    private BigDecimal valor(BigDecimal value) { return value == null ? BigDecimal.ZERO : value; }
}
