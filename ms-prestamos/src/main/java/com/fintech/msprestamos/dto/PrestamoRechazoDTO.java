package com.fintech.msprestamos.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class PrestamoRechazoDTO {
    @NotBlank(message = "El motivo de rechazo es obligatorio")
    @Size(max = 500, message = "El motivo no puede superar 500 caracteres")
    private String motivo;
}
