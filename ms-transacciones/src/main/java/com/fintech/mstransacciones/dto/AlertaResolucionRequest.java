package com.fintech.mstransacciones.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class AlertaResolucionRequest {
    @NotBlank
    @jakarta.validation.constraints.Size(max=1000)
    private String observacion;
    @Pattern(regexp = "RESUELTA|DESCARTADA", message = "La resolución debe ser RESUELTA o DESCARTADA")
    @NotNull
    private String estado;
}
