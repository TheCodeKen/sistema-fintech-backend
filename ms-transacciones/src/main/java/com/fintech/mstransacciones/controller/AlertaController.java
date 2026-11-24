package com.fintech.mstransacciones.controller;

import com.fintech.mstransacciones.dto.*;
import com.fintech.mstransacciones.service.AlertaService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.*;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/alertas")
@RequiredArgsConstructor
public class AlertaController {
    private final AlertaService service;

    @GetMapping
    public ResponseEntity<Page<AlertaResponse>> listar(
            @RequestParam(required = false) String nivelRiesgo,
            @RequestParam(required = false) String estado,
            @RequestParam(required = false) String tipoAlerta,
            @PageableDefault(size = 20, sort = "fechaDeteccion", direction = Sort.Direction.DESC) Pageable pageable) {
        return ResponseEntity.ok(service.listar(nivelRiesgo, estado, tipoAlerta, pageable));
    }

    @GetMapping("/pendientes/count")
    public ResponseEntity<Long> pendientes() { return ResponseEntity.ok(service.pendientes()); }

    @PatchMapping("/{id}/resolver")
    public ResponseEntity<AlertaResponse> resolver(@PathVariable Long id,
                                                    @Valid @RequestBody AlertaResolucionRequest request) {
        return ResponseEntity.ok(service.resolver(id, request));
    }

    @PostMapping("/{id}/bloquear-cuenta")
    public ResponseEntity<AlertaResponse> bloquear(@PathVariable Long id,
                                                    @RequestParam String observacion) {
        return ResponseEntity.ok(service.bloquearCuenta(id, observacion));
    }
}
