package com.fintech.msusuarios.dto;

import com.fintech.msusuarios.entity.Usuario;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class UsuarioRequest {

    @NotBlank(message = "El email es obligatorio")
    @Email(message = "Email inválido")
    @Size(max=100)
    private String email;

    @Size(min = 6, max = 72, message = "El password debe tener al menos 6 caracteres")
    private String password;

    @NotBlank(message = "El nombre es obligatorio")
    @Size(max=100)
    private String nombre;

    @NotBlank(message = "El apellido es obligatorio")
    @Size(max=100)
    private String apellido;

    @Size(max=20)
    private String telefono;

    @Size(max=20)
    private String dni;

    @NotNull(message = "El rol es obligatorio")
    private Usuario.Rol rol;
}
