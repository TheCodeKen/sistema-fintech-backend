package com.fintech.mscuentas.dto;
import java.math.BigDecimal;
import jakarta.validation.constraints.*;
public record MovimientoRequest(@NotBlank @Size(max=120) String operacionId,
        @NotNull @Positive Long origenId, Long destinoId,
        @NotNull @Digits(integer=13,fraction=2) BigDecimal delta,
        @NotBlank @Pattern(regexp="PEN|USD") String moneda) {}
