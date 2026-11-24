package com.fintech.msauditoria.service;

import com.fintech.msauditoria.dto.*;
import com.fintech.msauditoria.entity.Auditoria;
import com.fintech.msauditoria.repository.AuditoriaRepository;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.*;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;
import java.time.*;

@Service
@RequiredArgsConstructor
public class AuditoriaService {
    private final AuditoriaRepository repository;

    public AuditoriaResponse registrar(AuditoriaRequest request, HttpServletRequest httpRequest) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated()) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Se requiere un usuario autenticado");
        }
        String rol = auth.getAuthorities().stream().findFirst()
                .map(a -> a.getAuthority().replace("ROLE_", "")).orElse("DESCONOCIDO");
        Auditoria auditoria = Auditoria.builder().eventoId(java.util.UUID.randomUUID().toString())
                .usuarioEjecutor(auth.getName()).rolEjecutor(rol)
                .accion(request.getAccion().trim().toUpperCase())
                .entidadAfectada(request.getEntidadAfectada().trim().toUpperCase())
                .entidadId(request.getEntidadId()).detalles(request.getDetalles())
                .ipOrigen(resolveIp(httpRequest)).build();
        return AuditoriaResponse.from(repository.save(auditoria));
    }

    public Page<AuditoriaResponse> listar(String accion, String entidad, String usuario,
                                          LocalDate desde, LocalDate hasta, Pageable pageable) {
        if(desde!=null && hasta!=null && desde.isAfter(hasta))throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Rango de fechas inválido");
        LocalDateTime desdeTime = desde == null ? null : desde.atStartOfDay();
        LocalDateTime hastaTime = hasta == null ? null : hasta.plusDays(1).atStartOfDay();
        return repository.buscar(normalize(accion), normalize(entidad),
                usuario == null || usuario.isBlank() ? null : usuario.trim(),
                desdeTime, hastaTime, pageable).map(AuditoriaResponse::from);
    }

    private String normalize(String value) {
        return value == null || value.isBlank() ? null : value.trim().toUpperCase();
    }

    private String resolveIp(HttpServletRequest request) {
        if (request == null) return null;
        String forwarded = request.getHeader("X-Forwarded-For");
        return forwarded == null || forwarded.isBlank() ? request.getRemoteAddr() : forwarded.split(",")[0].trim();
    }
}
