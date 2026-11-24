package com.fintech.msauditoria.dto;
import jakarta.validation.constraints.*;
import java.time.LocalDateTime;

public record EventoAuditoria(@NotBlank @Size(max=64) String eventoId,
        @NotBlank @Size(max=150) String usuarioEjecutor, @NotBlank @Size(max=30) String rolEjecutor,
        @NotBlank @Size(max=80) String accion, @NotBlank @Size(max=40) String entidadAfectada,
        @NotNull Long entidadId, @Size(max=2000) String detalles,
        @NotNull LocalDateTime fechaRegistro, @Size(max=45) String ipOrigen) {}
