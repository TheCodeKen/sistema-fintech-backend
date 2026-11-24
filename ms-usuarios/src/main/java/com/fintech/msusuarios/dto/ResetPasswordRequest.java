package com.fintech.msusuarios.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class ResetPasswordRequest {

    @NotBlank(message = "El token es obligatorio")
    private String token;

    @NotBlank(message = "La nueva contraseña es obligatoria")
    @jakarta.validation.constraints.Size(min = 6, max = 72)
    private String nuevaPassword;
}