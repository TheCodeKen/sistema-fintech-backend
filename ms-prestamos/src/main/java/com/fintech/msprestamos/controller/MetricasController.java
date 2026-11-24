package com.fintech.msprestamos.controller;
import com.fintech.msprestamos.dto.PrestamosMetricasResponse;
import com.fintech.msprestamos.entity.Prestamo.EstadoPrestamo;
import com.fintech.msprestamos.repository.PrestamoRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.math.BigDecimal;

@RestController
@RequestMapping("/api/prestamos/metricas")
@RequiredArgsConstructor
public class MetricasController {
    private final PrestamoRepository repository;
    @GetMapping
    public ResponseEntity<PrestamosMetricasResponse> obtener() {
        return ResponseEntity.ok(PrestamosMetricasResponse.builder()
                .montoDesembolsado(valor(repository.sumMontoByEstado(EstadoPrestamo.DESEMBOLSADO)))
                .pendientesAtencion(repository.countByEstado(EstadoPrestamo.PENDIENTE)
                        + repository.countByEstado(EstadoPrestamo.EN_REVISION)).build());
    }
    private BigDecimal valor(BigDecimal value) { return value == null ? BigDecimal.ZERO : value; }
}
