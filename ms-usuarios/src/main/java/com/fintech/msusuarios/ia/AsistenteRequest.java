package com.fintech.msusuarios.ia;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.util.List;

public record AsistenteRequest(@NotBlank @Size(max=1200) String mensaje,@NotNull Modo modo,
        boolean consultarDatos,@Size(max=6) List<@NotNull @Valid Turno> historial) {
    public enum Modo {CLIENTE,ADMIN}
    public enum Rol {USER,ASSISTANT}
    public record Turno(@NotNull Rol rol,@NotBlank @Size(max=2400) String texto){}
}
