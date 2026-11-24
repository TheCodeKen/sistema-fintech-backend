package com.fintech.msauditoria.dto;

import com.fintech.msauditoria.entity.Auditoria;
import lombok.Builder;
import lombok.Value;
import java.time.LocalDateTime;

@Value
@Builder
public class AuditoriaResponse {
    Long id;
    String eventoId;
    Long legacyId;
    String usuarioEjecutor;
    String rolEjecutor;
    String accion;
    String entidadAfectada;
    Long entidadId;
    String detalles;
    LocalDateTime fechaRegistro;
    String ipOrigen;

    public static AuditoriaResponse from(Auditoria a) {
        return AuditoriaResponse.builder().id(a.getId()).eventoId(a.getEventoId()).legacyId(a.getLegacyId()).usuarioEjecutor(a.getUsuarioEjecutor())
                .rolEjecutor(a.getRolEjecutor()).accion(a.getAccion())
                .entidadAfectada(a.getEntidadAfectada()).entidadId(a.getEntidadId())
                .detalles(a.getDetalles()).fechaRegistro(a.getFechaRegistro())
                .ipOrigen(a.getIpOrigen()).build();
    }
}
