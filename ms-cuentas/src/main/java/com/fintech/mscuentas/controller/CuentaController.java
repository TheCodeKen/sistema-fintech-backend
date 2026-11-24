package com.fintech.mscuentas.controller;

import com.fintech.mscuentas.dto.CrearCuentaDTO;
import com.fintech.mscuentas.dto.CuentaResponse;
import com.fintech.mscuentas.service.CuentaService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.List;
import org.springframework.beans.factory.annotation.Value;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;

@RestController
@RequestMapping("/api/cuentas")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
public class CuentaController {

    private final CuentaService cuentaService;
    private final com.fintech.mscuentas.service.AperturaCuentaService aperturas;
    private final com.fintech.mscuentas.service.MovimientoService movimientoService;
    @PostMapping("/internal/movimientos")
    public ResponseEntity<Void> aplicar(@Valid @RequestBody com.fintech.mscuentas.dto.MovimientoRequest r) {
        movimientoService.aplicar(r);
        return ResponseEntity.noContent().build();
    }
    @Value("${app.internal.service-key}")
    private String internalServiceKey;

    // GET /api/cuentas
    @GetMapping
    public ResponseEntity<Page<CuentaResponse>> listarTodas(
            @RequestParam(required = false) String moneda,
            @RequestParam(required = false) String estado,
            @RequestParam(required = false) String numeroCuenta,
            @PageableDefault(size = 10, sort = "fechaApertura") Pageable pageable) {
        return ResponseEntity.ok(cuentaService.listarTodas(moneda, estado, numeroCuenta, pageable));
    }

    // GET /api/cuentas/usuario/{usuarioId}
    @GetMapping("/usuario/{usuarioId}")
    public ResponseEntity<List<CuentaResponse>> listarPorUsuario(@PathVariable Long usuarioId) {
        return ResponseEntity.ok(cuentaService.listarPorUsuario(usuarioId));
    }

    // GET /api/cuentas/{id}
    @GetMapping("/{id}")
    public ResponseEntity<CuentaResponse> buscarPorId(@PathVariable Long id) {
        return ResponseEntity.ok(cuentaService.buscarPorId(id));
    }

    @GetMapping("/numero/{numeroCuenta}")
    public ResponseEntity<CuentaResponse> buscarPorNumero(@PathVariable String numeroCuenta) {
        return ResponseEntity.ok(cuentaService.buscarPorNumero(numeroCuenta));
    }

    // POST /api/cuentas
    @PostMapping
    public ResponseEntity<CuentaResponse> crear(@Valid @RequestBody CrearCuentaDTO request,
            @RequestHeader(value="Idempotency-Key", required=false) String clave) {
        return ResponseEntity.status(HttpStatus.CREATED).body(aperturas.crear(request, clave));
    }

    @PatchMapping("/{id}/activar")
    public ResponseEntity<CuentaResponse> activar(@PathVariable Long id) {
        return ResponseEntity.ok(cuentaService.activar(id));
    }

    @PatchMapping("/{id}/bloquear")
    public ResponseEntity<CuentaResponse> bloquear(@PathVariable Long id, @RequestParam String motivo) {
        return ResponseEntity.ok(cuentaService.bloquear(id, motivo));
    }

    @PatchMapping("/{id}/congelar")
    public ResponseEntity<CuentaResponse> congelar(@PathVariable Long id, @RequestParam String motivo) {
        return ResponseEntity.ok(cuentaService.congelar(id, motivo));
    }

    @PatchMapping("/{id}/desbloquear")
    public ResponseEntity<CuentaResponse> desbloquear(@PathVariable Long id) {
        return ResponseEntity.ok(cuentaService.desbloquear(id));
    }

    @PatchMapping("/{id}/cerrar")
    public ResponseEntity<CuentaResponse> cerrar(@PathVariable Long id) {
        return ResponseEntity.ok(cuentaService.cerrar(id));
    }

    @PutMapping("/{id}/saldo")
    public ResponseEntity<CuentaResponse> actualizarSaldo(
            @PathVariable Long id,
            @RequestParam BigDecimal delta,
            HttpServletRequest request) {
        validarServicioInterno(request);
        throw new org.springframework.web.server.ResponseStatusException(HttpStatus.GONE,
                "Utilice movimientos internos idempotentes");
    }

    private void validarServicioInterno(HttpServletRequest request) {
        // La cabecera es añadida únicamente por los clientes Feign internos.
        // El valor nunca se acepta desde el frontend.
        if (!internalServiceKey.equals(request.getHeader("X-Internal-Service"))) {
            throw new org.springframework.web.server.ResponseStatusException(
                    HttpStatus.FORBIDDEN, "Operación disponible únicamente para servicios internos");
        }
    }

    // DELETE /api/cuentas/{id}
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> eliminar(@PathVariable Long id) {
        cuentaService.eliminar(id);
        return ResponseEntity.noContent().build();
    }
}
