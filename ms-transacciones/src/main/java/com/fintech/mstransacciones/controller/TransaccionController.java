package com.fintech.mstransacciones.controller;

import com.fintech.mstransacciones.dto.TransaccionRequest;
import com.fintech.mstransacciones.dto.TransaccionResponse;
import com.fintech.mstransacciones.service.TransaccionService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.List;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;

@RestController
@RequestMapping("/api/transacciones")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
public class TransaccionController {

    private final TransaccionService transaccionService;
    private final com.fintech.mstransacciones.service.ComprobanteService comprobantes;

    @PostMapping("/revisar")
    public ResponseEntity<com.fintech.mstransacciones.dto.RevisionMovimiento> revisar(@Valid @RequestBody TransaccionRequest request) {
        return ResponseEntity.ok(transaccionService.revisar(request));
    }

    @GetMapping("/{id}/detalle")
    public ResponseEntity<com.fintech.mstransacciones.dto.TransaccionDetalle> detalle(@PathVariable Long id) {
        return ResponseEntity.ok(transaccionService.detalle(id));
    }

    @GetMapping("/{id}/comprobante")
    public ResponseEntity<byte[]> comprobante(@PathVariable Long id) {
        byte[] pdf=comprobantes.generar(transaccionService.detalle(id));
        return ResponseEntity.ok().contentType(org.springframework.http.MediaType.APPLICATION_PDF)
                .header("Content-Disposition","attachment; filename=\"comprobante-"+id+".pdf\"")
                .header("Cache-Control","no-store, private").header("X-Content-Type-Options","nosniff").body(pdf);
    }

    // GET /api/transacciones
    @GetMapping
    public ResponseEntity<Page<TransaccionResponse>> listarTodas(
            @RequestParam(required = false) String tipo,
            @RequestParam(required = false) String estado,
            @RequestParam(required = false) String numeroCuenta,
            @RequestParam(required = false) String desde,
            @RequestParam(required = false) String hasta,
            @PageableDefault(size = 10, sort = "fechaTransaccion") Pageable pageable) {
        return ResponseEntity.ok(transaccionService.listarTodas(tipo, estado, numeroCuenta, desde, hasta, pageable));
    }

    // GET /api/transacciones/cuenta/{cuentaId}
    @GetMapping("/cuenta/{cuentaId}")
    public ResponseEntity<List<TransaccionResponse>> listarPorCuenta(@PathVariable Long cuentaId) {
        return ResponseEntity.ok(transaccionService.listarPorCuenta(cuentaId));
    }

    // GET /api/transacciones/{id}
    @GetMapping("/{id}")
    public ResponseEntity<TransaccionResponse> buscarPorId(@PathVariable Long id) {
        return ResponseEntity.ok(transaccionService.buscarPorId(id));
    }

    // POST /api/transacciones
    @PostMapping
    public ResponseEntity<TransaccionResponse> crear(@Valid @RequestBody TransaccionRequest request, @RequestHeader("Idempotency-Key") String operacionId) {
        request.setOperacionId(operacionId);
        return ResponseEntity.status(HttpStatus.CREATED).body(transaccionService.crear(request));
    }

    @PostMapping("/{id}/revertir")
    public ResponseEntity<TransaccionResponse> revertir(@PathVariable Long id) {
        return ResponseEntity.status(HttpStatus.CREATED).body(transaccionService.revertir(id));
    }
}
