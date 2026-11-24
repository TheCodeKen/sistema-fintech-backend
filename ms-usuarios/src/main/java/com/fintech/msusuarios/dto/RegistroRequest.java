package com.fintech.msusuarios.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

/**
 * DTO para auto-registro de clientes.
 * No expone el campo 'rol' — siempre se asigna CLIENTE.
 */
@Data
public class RegistroRequest {

    @NotBlank(message = "El email es obligatorio")
    @Email(message = "Email inválido")
    @Size(max=100)
    private String email;

    @NotBlank(message = "La contraseña es obligatoria")
    @Size(min = 6, max = 72, message = "La contraseña debe tener al menos 6 caracteres")
    private String password;

    @NotBlank(message = "El nombre es obligatorio")
    @Size(max=100)
    private String nombre;

    @NotBlank(message = "El apellido es obligatorio")
    @Size(max=100)
    private String apellido;

    @Size(max=20)
    private String telefono;
}
