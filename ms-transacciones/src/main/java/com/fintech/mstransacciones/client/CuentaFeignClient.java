package com.fintech.mstransacciones.client;

import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.PatchMapping;

import java.math.BigDecimal;

/**
 * ★ FeignClient → ms-cuentas (Puerto 8082) ★
 *
 * ms-transacciones lo usa para validar saldo suficiente
 * antes de registrar un RETIRO o TRANSFERENCIA.
 */
@FeignClient(name = "ms-cuentas-txn", url = "${feign.client.ms-cuentas.url}")
public interface CuentaFeignClient {
    @org.springframework.web.bind.annotation.PostMapping("/api/cuentas/internal/movimientos")
    void aplicar(@org.springframework.web.bind.annotation.RequestBody com.fintech.mstransacciones.dto.MovimientoRequest request);

    /**
     * Obtiene datos de la cuenta (incluyendo saldo) desde ms-cuentas.
     * Mapea: GET http://localhost:8082/api/cuentas/{id}
     */
    @GetMapping("/api/cuentas/{id}")
    CuentaClientDTO obtenerCuentaPorId(@PathVariable("id") Long id);

    /**
     * Busca una cuenta por el número que el cliente utiliza para transferir.
     */
    @GetMapping("/api/cuentas/numero/{numeroCuenta}")
    CuentaClientDTO obtenerCuentaPorNumero(@PathVariable("numeroCuenta") String numeroCuenta);

    /**
     * Ajusta el saldo de la cuenta en ms-cuentas.
     * delta negativo = descuenta; delta positivo = abona.
     */
    @PutMapping("/api/cuentas/{id}/saldo")
    void actualizarSaldo(
            @PathVariable("id") Long id,
            @RequestParam("delta") BigDecimal delta);

    @PatchMapping("/api/cuentas/{id}/bloquear")
    CuentaClientDTO bloquearCuenta(@PathVariable("id") Long id, @RequestParam("motivo") String motivo);
}
