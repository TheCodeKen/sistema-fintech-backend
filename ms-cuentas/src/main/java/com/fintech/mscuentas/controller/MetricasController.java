package com.fintech.mscuentas.controller;
import com.fintech.mscuentas.dto.CuentasMetricasResponse;
import com.fintech.mscuentas.entity.Cuenta.EstadoCuenta;
import com.fintech.mscuentas.repository.CuentaRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.math.BigDecimal;
import java.util.Map;

@RestController
@RequestMapping("/api/cuentas/metricas")
@RequiredArgsConstructor
public class MetricasController {
    private final CuentaRepository repository;
    @GetMapping
    public ResponseEntity<CuentasMetricasResponse> obtener() {
        return ResponseEntity.ok(CuentasMetricasResponse.builder()
                .porEstado(Map.of("ACTIVA", repository.countByEstado(EstadoCuenta.ACTIVA),
                        "BLOQUEADA", repository.countByEstado(EstadoCuenta.BLOQUEADA),
                        "CONGELADA", repository.countByEstado(EstadoCuenta.CONGELADA)))
                .saldoPen(valor(repository.totalSaldoPorMoneda("PEN")))
                .saldoUsd(valor(repository.totalSaldoPorMoneda("USD"))).build());
    }
    private BigDecimal valor(BigDecimal value) { return value == null ? BigDecimal.ZERO : value; }
}
