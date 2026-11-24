package com.fintech.msusuarios.service;

import com.fintech.msusuarios.dto.*;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import java.time.LocalDateTime;

@Service
@RequiredArgsConstructor
public class AuditoriaService {
    private final ColaAuditoria cola;
    @Transactional
    public AuditoriaResponse registrar(AuditoriaRequest request,HttpServletRequest http) {
        var auth=SecurityContextHolder.getContext().getAuthentication();
        if(auth==null || !auth.isAuthenticated())throw new ResponseStatusException(HttpStatus.UNAUTHORIZED);
        String rol=auth.getAuthorities().stream().findFirst().map(a->a.getAuthority().replace("ROLE_","")).orElse("DESCONOCIDO");
        LocalDateTime fecha=LocalDateTime.now().truncatedTo(java.time.temporal.ChronoUnit.MICROS);
        String ip=http==null ? null : http.getRemoteAddr();
        var evento=new EventoAuditoria(java.util.UUID.randomUUID().toString(),auth.getName(),rol,
            request.getAccion().trim().toUpperCase(java.util.Locale.ROOT),request.getEntidadAfectada().trim().toUpperCase(java.util.Locale.ROOT),
            request.getEntidadId(),request.getDetalles(),fecha,ip);
        cola.recibir(evento);
        return AuditoriaResponse.builder().eventoId(evento.eventoId()).usuarioEjecutor(evento.usuarioEjecutor()).rolEjecutor(rol).accion(evento.accion())
            .entidadAfectada(evento.entidadAfectada()).entidadId(evento.entidadId()).detalles(evento.detalles()).fechaRegistro(fecha).ipOrigen(ip).build();
    }
}
