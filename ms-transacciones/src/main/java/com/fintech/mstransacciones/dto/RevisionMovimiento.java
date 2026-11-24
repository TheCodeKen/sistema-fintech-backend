package com.fintech.mstransacciones.dto;

import java.math.BigDecimal;

/** Only the origin balance is exposed; the destination is identified by account number. */
public record RevisionMovimiento(String numeroCuentaOrigen, String numeroCuentaDestino,
        String moneda, BigDecimal monto, BigDecimal saldoDisponible, BigDecimal saldoEstimado) {}
