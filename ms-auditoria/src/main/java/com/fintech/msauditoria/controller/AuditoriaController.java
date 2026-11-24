package com.fintech.msauditoria.controller;

import com.fintech.msauditoria.dto.*;
import com.fintech.msauditoria.service.AuditoriaService;
import com.fintech.msauditoria.service.RecepcionEventos;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.*;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import java.time.LocalDate;

@RestController
@RequestMapping("/api/auditoria")
@RequiredArgsConstructor
public class AuditoriaController {
    private final AuditoriaService auditoria;
    private final RecepcionEventos eventos;
    @Value("${app.internal.service-key}") private String key;
    @GetMapping
    public ResponseEntity<Page<AuditoriaResponse>> listar(@RequestParam(required=false) String accion,
            @RequestParam(required=false) String entidadAfectada,@RequestParam(required=false) String usuarioEjecutor,
            @RequestParam(required=false) LocalDate desde,@RequestParam(required=false) LocalDate hasta,
            @PageableDefault(size=20,sort="fechaRegistro",direction=Sort.Direction.DESC) Pageable pageable) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore())
            .body(auditoria.listar(accion,entidadAfectada,usuarioEjecutor,desde,hasta,pageable));
    }
    @PostMapping("/internal/eventos") @ResponseStatus(HttpStatus.NO_CONTENT)
    public void evento(@Valid @RequestBody EventoAuditoria evento,@RequestHeader(value="X-Internal-Service",required=false) String received) {
        comprobarClave(received);eventos.recibir(evento);
    }
    @PostMapping("/internal")
    public ResponseEntity<AuditoriaResponse> registrar(@Valid @RequestBody AuditoriaRequest request,
            @RequestHeader(value="X-Internal-Service",required=false) String received,HttpServletRequest http) {
        comprobarClave(received);return ResponseEntity.status(201).body(auditoria.registrar(request,http));
    }
    private void comprobarClave(String received) {
        if(key.isBlank() || received==null || !java.security.MessageDigest.isEqual(key.getBytes(java.nio.charset.StandardCharsets.UTF_8),received.getBytes(java.nio.charset.StandardCharsets.UTF_8)))
            throw new ResponseStatusException(HttpStatus.FORBIDDEN,"Operación interna.");
    }
}
