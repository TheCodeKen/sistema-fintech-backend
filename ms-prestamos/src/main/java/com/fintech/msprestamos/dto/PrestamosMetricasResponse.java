package com.fintech.msprestamos.dto;
import lombok.Builder;
import lombok.Value;
import java.math.BigDecimal;
@Value @Builder
public class PrestamosMetricasResponse {
    BigDecimal montoDesembolsado;
    long pendientesAtencion;
}
