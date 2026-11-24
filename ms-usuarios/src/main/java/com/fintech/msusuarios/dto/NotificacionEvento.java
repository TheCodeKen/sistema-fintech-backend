package com.fintech.msusuarios.dto;

import jakarta.validation.constraints.*;
import java.time.LocalDateTime;

public record NotificacionEvento(@NotBlank @Size(max=180) String clave,@NotNull @Positive Long usuarioId,
        @NotNull Tipo tipo,@NotNull @Positive Long recursoId,@NotBlank @Size(max=120) String titulo,
        @NotBlank @Size(max=600) String mensaje,@NotNull LocalDateTime fechaEvento) {
    public enum Tipo {
        MOVIMIENTO_CONFIRMADO,MOVIMIENTO_REVERTIDO,PRESTAMO_SOLICITADO,PRESTAMO_EN_REVISION,
        PRESTAMO_APROBADO,PRESTAMO_RECHAZADO,PRESTAMO_CANCELADO,PRESTAMO_DESEMBOLSADO,
        PRESTAMO_PAGO,PRESTAMO_PAGADO,CUOTA_PROXIMA,CUOTA_VENCIDA
    }
}
