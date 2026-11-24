package com.fintech.msusuarios.controller;

import com.fintech.msusuarios.dto.*;
import com.fintech.msusuarios.service.AuditoriaService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.*;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.ResponseEntity;
import org.springframework.http.HttpStatus;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import java.time.LocalDate;

@RestController
@RequestMapping("/api/auditoria")
@RequiredArgsConstructor
public class AuditoriaController {
    private final AuditoriaService auditoriaService;
    @Value("${app.internal.service-key}")
    private String internalServiceKey;
    @Value("${services.auditoria.url:http://localhost:8085}") private String auditoriaUrl;

    @GetMapping
    public ResponseEntity<com.fasterxml.jackson.databind.JsonNode> listar(
            @RequestParam(required = false) String accion,
            @RequestParam(required = false) String entidadAfectada,
            @RequestParam(required = false) String usuarioEjecutor,
            @RequestParam(required = false) LocalDate desde,
            @RequestParam(required = false) LocalDate hasta,
            @PageableDefault(size = 20, sort = "fechaRegistro", direction = Sort.Direction.DESC) Pageable pageable,
            HttpServletRequest request) {
        String query=request.getQueryString();
        try {
            var body=com.fintech.msusuarios.config.HttpClients.create(auditoriaUrl).get()
                .uri(java.net.URI.create(auditoriaUrl+"/api/auditoria"+(query==null ? "" : "?"+query)))
                .header("Authorization",request.getHeader("Authorization")).retrieve().body(com.fasterxml.jackson.databind.JsonNode.class);
            return ResponseEntity.ok().cacheControl(org.springframework.http.CacheControl.noStore()).body(body);
        } catch(org.springframework.web.client.RestClientResponseException ex) {
            throw new ResponseStatusException(ex.getStatusCode(),"No se pudo consultar la auditoría.");
        } catch(org.springframework.web.client.RestClientException ex) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,"El servicio de auditoría no está disponible.");
        }
    }

    @PostMapping("/internal")
    public ResponseEntity<AuditoriaResponse> registrar(@Valid @RequestBody AuditoriaRequest request,
                                                       HttpServletRequest httpRequest) {
        if (internalServiceKey == null || internalServiceKey.isBlank() || !internalServiceKey.equals(httpRequest.getHeader("X-Internal-Service"))) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Endpoint exclusivo para servicios internos");
        }
        return ResponseEntity.accepted().body(auditoriaService.registrar(request, httpRequest));
    }
}
