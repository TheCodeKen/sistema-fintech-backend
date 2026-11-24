package com.fintech.mstransacciones.dto;
import lombok.Builder;
import lombok.Value;
import java.math.BigDecimal;
import java.util.Map;
@Value @Builder
public class TransaccionesMetricasResponse {
    BigDecimal montoHoy;
    long cantidadHoy;
    Map<String, Long> porTipo;
}
