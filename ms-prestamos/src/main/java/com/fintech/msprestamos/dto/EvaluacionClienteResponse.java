package com.fintech.msprestamos.dto;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

public record EvaluacionClienteResponse(PrestamoResponse solicitud, LocalDate fechaCorte,
        long totalOtrosPrestamos, Map<String,Long> porEstado, List<ResumenMoneda> saldos,
        long prestamosSinCronograma, List<PrestamoResponse> prestamosRecientes, int paginaPrestamos, int totalPaginasPrestamos,
        long totalPagos, List<Pago> pagosRecientes) {
    public record ResumenMoneda(String moneda, long prestamosVigentes, BigDecimal saldoPendiente,
            BigDecimal cuotaMensual, long cuotasVencidas, BigDecimal saldoVencido, LocalDate primerVencimiento) {}
    public record Pago(Long prestamoId, String numeroPrestamo, String moneda, BigDecimal monto,
            LocalDateTime fechaPago, Long transaccionId) {}
}
