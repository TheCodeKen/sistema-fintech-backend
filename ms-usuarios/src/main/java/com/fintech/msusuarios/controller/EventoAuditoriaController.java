package com.fintech.msusuarios.controller;

import com.fintech.msusuarios.dto.EventoAuditoria;
import com.fintech.msusuarios.service.ColaAuditoria;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

/** Compatibility receiver for producers using the previous URL during a rolling update. */
@RestController
@RequestMapping("/api/auditoria/internal/eventos")
@RequiredArgsConstructor
public class EventoAuditoriaController {
    private final ColaAuditoria cola;
    @Value("${app.internal.service-key}") private String key;
    @PostMapping @ResponseStatus(HttpStatus.NO_CONTENT)
    public void registrar(@Valid @RequestBody EventoAuditoria evento,@RequestHeader(value="X-Internal-Service",required=false) String received) {
        if(key.isBlank() || !key.equals(received))throw new ResponseStatusException(HttpStatus.FORBIDDEN,"Operacion interna");
        cola.recibir(evento);
    }
}
