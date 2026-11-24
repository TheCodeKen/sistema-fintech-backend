package com.fintech.msprestamos.controller;

import com.fintech.msprestamos.dto.*;
import com.fintech.msprestamos.service.PrestamoService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.List;

@RestController
@RequestMapping("/api/prestamos")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
public class PrestamoController {
    private final PrestamoService prestamoService;
    private final com.fintech.msprestamos.service.SolicitudPrestamoService solicitudes;
    private final com.fintech.msprestamos.service.EvaluacionClienteService evaluaciones;

    @GetMapping("/{id}/evaluacion")
    public ResponseEntity<EvaluacionClienteResponse> evaluacion(@PathVariable Long id, @RequestParam(defaultValue="0") int pagina) {
        return ResponseEntity.ok().cacheControl(org.springframework.http.CacheControl.noStore()).body(evaluaciones.consultar(id,pagina));
    }
    private final com.fintech.msprestamos.repository.PrestamoRepository repository;

    @GetMapping("/internal/obligaciones/{cuentaId}")
    public long obligaciones(@PathVariable Long cuentaId) {
        com.fintech.msprestamos.config.security.Acceso.soloInterno();
        return repository.countByCuentaDesembolsoIdAndEstadoNotIn(cuentaId, java.util.List.of(
            com.fintech.msprestamos.entity.Prestamo.EstadoPrestamo.RECHAZADO,
            com.fintech.msprestamos.entity.Prestamo.EstadoPrestamo.PAGADO,
            com.fintech.msprestamos.entity.Prestamo.EstadoPrestamo.CANCELADO));
    }

    @GetMapping
    public ResponseEntity<Page<PrestamoResponse>> listarTodos(
            @RequestParam(required = false) String estado,
            @RequestParam(required = false) Long usuarioId,
            @RequestParam(required = false) BigDecimal montoMin,
            @RequestParam(required = false) BigDecimal montoMax,
            @PageableDefault(size = 10, sort = "fechaSolicitud") Pageable pageable) {
        return ResponseEntity.ok(prestamoService.listarTodos(estado, usuarioId, montoMin, montoMax, pageable));
    }

    @GetMapping("/{id}/detalle")
    public ResponseEntity<PrestamoDetalleResponse> detalle(@PathVariable Long id) {
        return ResponseEntity.ok(prestamoService.detalle(id));
    }
    @PostMapping("/{id}/cancelar")
    public ResponseEntity<PrestamoResponse> cancelar(@PathVariable Long id,
            @Valid @RequestBody PrestamoCancelacionRequest request) {
        return ResponseEntity.ok(prestamoService.cancelar(id,request.motivo()));
    }

    @GetMapping("/{id}")
    public ResponseEntity<PrestamoResponse> buscarPorId(@PathVariable Long id) {
        return ResponseEntity.ok(prestamoService.buscarPorId(id));
    }

    @GetMapping("/usuario/{usuarioId}")
    public ResponseEntity<List<PrestamoResponse>> listarPorUsuario(@PathVariable Long usuarioId) {
        return ResponseEntity.ok(prestamoService.listarPorUsuario(usuarioId));
    }

    @PostMapping
    public ResponseEntity<PrestamoResponse> crear(@Valid @RequestBody PrestamoRequest request,
            @RequestHeader(value = "Idempotency-Key", required = false) String clave) {
        return ResponseEntity.status(HttpStatus.CREATED).body(solicitudes.crear(request, clave));
    }

    @PatchMapping("/{id}/revisar")
    public ResponseEntity<PrestamoResponse> revisar(@PathVariable Long id) {
        return ResponseEntity.ok(prestamoService.revisar(id));
    }

    @PatchMapping("/{id}/aprobar")
    public ResponseEntity<PrestamoResponse> aprobar(@PathVariable Long id, @Valid @RequestBody(required = false) PrestamoRevisionDTO request) {
        return ResponseEntity.ok(prestamoService.aprobar(id, request == null ? null : request.getObservacion()));
    }

    @PatchMapping("/{id}/rechazar")
    public ResponseEntity<PrestamoResponse> rechazar(@PathVariable Long id, @Valid @RequestBody PrestamoRechazoDTO request) {
        return ResponseEntity.ok(prestamoService.rechazar(id, request.getMotivo()));
    }

    @PostMapping("/{id}/desembolsar")
    public ResponseEntity<PrestamoResponse> desembolsar(@PathVariable Long id) {
        return ResponseEntity.ok(prestamoService.desembolsar(id));
    }

    @PostMapping("/{id}/pagar")
    public ResponseEntity<PrestamoResponse> pagar(@PathVariable Long id, @Valid @RequestBody PagoPrestamoDTO request) {
        return ResponseEntity.ok(prestamoService.pagar(id, request));
    }
}
