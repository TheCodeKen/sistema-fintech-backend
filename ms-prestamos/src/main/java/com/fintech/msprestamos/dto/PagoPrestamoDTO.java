package com.fintech.msprestamos.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.math.BigDecimal;

@Data
public class PagoPrestamoDTO {
    @jakarta.validation.constraints.NotBlank
    @jakarta.validation.constraints.Pattern(regexp="[A-Za-z0-9_-]{8,64}")
    private String operacionId;
    @NotNull
    @DecimalMin(value = "0.01", message = "El monto debe ser mayor a 0")
    @jakarta.validation.constraints.Digits(integer=13, fraction=2)
    private BigDecimal monto;

    @NotNull
    private Long cuentaId;
}
