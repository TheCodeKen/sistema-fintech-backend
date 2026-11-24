package com.fintech.msprestamos.dto;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
public record PrestamoDetalleResponse(PrestamoResponse prestamo, BigDecimal totalPactado,
        BigDecimal totalPagado, BigDecimal saldoVencido, LocalDate proximoVencimiento,
        BigDecimal importeProximaCuota, int cuotasPagadas, int cuotasVencidas,
        List<Cuota> cuotas, List<Pago> pagos, String advertencia) {
    public record Cuota(int numero, LocalDate vencimiento, BigDecimal importe,
            BigDecimal pagado, BigDecimal pendiente, String estado) {}
    public record Pago(String operacionId, Long cuentaId, BigDecimal monto,
            LocalDateTime fechaPago, Long transaccionId, boolean historico) {}
}
