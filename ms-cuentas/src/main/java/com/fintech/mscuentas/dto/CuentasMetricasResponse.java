package com.fintech.mscuentas.dto;
import lombok.Builder;
import lombok.Value;
import java.math.BigDecimal;
import java.util.Map;
@Value @Builder
public class CuentasMetricasResponse {
    Map<String, Long> porEstado;
    BigDecimal saldoPen;
    BigDecimal saldoUsd;
}
