package com.fintech.mstransacciones.dto;
import java.math.BigDecimal;
public record MovimientoRequest(String operacionId, Long origenId, Long destinoId, BigDecimal delta, String moneda) {}
