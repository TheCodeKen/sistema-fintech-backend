package com.fintech.msprestamos.dto;

import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class PrestamoRevisionDTO {
    @Size(max = 500, message = "La observación no puede superar 500 caracteres")
    private String observacion;
}
