package com.fintech.msusuarios.dto;

import com.fintech.msusuarios.entity.Auditoria;
import lombok.Builder;
import lombok.Value;
import java.time.LocalDateTime;

@Value
@Builder
public class AuditoriaResponse {
    Long id;
    String eventoId;
    String usuarioEjecutor;
    String rolEjecutor;
    String accion;
    String entidadAfectada;
    Long entidadId;
    String detalles;
    LocalDateTime fechaRegistro;
    String ipOrigen;

    public static AuditoriaResponse from(Auditoria a) {
        return AuditoriaResponse.builder().id(a.getId()).eventoId(a.getEventoId()).usuarioEjecutor(a.getUsuarioEjecutor())
                .rolEjecutor(a.getRolEjecutor()).accion(a.getAccion())
                .entidadAfectada(a.getEntidadAfectada()).entidadId(a.getEntidadId())
                .detalles(a.getDetalles()).fechaRegistro(a.getFechaRegistro())
                .ipOrigen(a.getIpOrigen()).build();
    }
}
