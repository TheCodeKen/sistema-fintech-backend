package com.fintech.msauditoria.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class AuditoriaRequest {
    @NotBlank private String accion;
    @NotBlank private String entidadAfectada;
    @NotNull private Long entidadId;
    @Size(max = 2000) private String detalles;
}
