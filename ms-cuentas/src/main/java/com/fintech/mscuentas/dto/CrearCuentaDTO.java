package com.fintech.mscuentas.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.math.BigDecimal;

@Data
public class CrearCuentaDTO {
    @NotNull
    private Long usuarioId;

    @NotNull
    private String tipoCuenta;

    @NotNull
    private String moneda;

    @DecimalMin(value = "0.00", inclusive = true)
    @jakarta.validation.constraints.Digits(integer=13,fraction=2)
    private BigDecimal saldoInicial = BigDecimal.ZERO;
}
