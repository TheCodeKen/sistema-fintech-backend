package com.fintech.msprestamos.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class TransaccionClientRequest {
    private Long cuentaOrigenId;
    private Long cuentaDestinoId;
    private String tipoTransaccion;
    private BigDecimal monto;
    private String moneda;
    private String descripcion;
}
