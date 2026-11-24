package com.fintech.msusuarios.dto;

import com.fintech.msusuarios.entity.Notificacion;
import java.time.LocalDateTime;

public record NotificacionResponse(Long id,String tipo,String titulo,String mensaje,String enlace,
        LocalDateTime fechaEvento,LocalDateTime leidaEn) {
    public static NotificacionResponse from(Notificacion n){
        String ruta=n.getTipo().startsWith("MOVIMIENTO_") ? "/transacciones/" : "/prestamos/";
        return new NotificacionResponse(n.getId(),n.getTipo(),n.getTitulo(),n.getMensaje(),ruta+n.getRecursoId(),n.getFechaEvento(),n.getLeidaEn());
    }
}
