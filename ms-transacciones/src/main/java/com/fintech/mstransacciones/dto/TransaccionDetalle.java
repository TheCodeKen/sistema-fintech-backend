package com.fintech.mstransacciones.dto;

public record TransaccionDetalle(TransaccionResponse movimiento, TransaccionResponse original,
        TransaccionResponse reversion) {}
