package com.fintech.mstransacciones.dto;

import com.fintech.mstransacciones.entity.Transaccion;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Data;
import java.math.BigDecimal;

@Data
public class TransaccionRequest {
    private String operacionId;

    private Long cuentaOrigenId;

    @Size(max = 10, message = "El número de cuenta origen no puede superar 10 caracteres")
    @Pattern(regexp = "^FT\\d{1,8}$", message = "El número de cuenta origen debe tener el formato FT seguido de hasta 8 dígitos")
    private String numeroCuentaOrigen;

    @Size(max = 10, message = "El número de cuenta destino no puede superar 10 caracteres")
    @Pattern(regexp = "^FT\\d{1,8}$", message = "El número de cuenta destino debe tener el formato FT seguido de hasta 8 dígitos")
    private String numeroCuentaDestino;

    @NotNull(message = "El tipo de transacción es obligatorio")
    private Transaccion.TipoTransaccion tipoTransaccion;

    @NotNull(message = "El monto es obligatorio")
    @DecimalMin(value = "0.01", message = "El monto debe ser mayor a 0")
    @jakarta.validation.constraints.Digits(integer=13, fraction=2)
    private BigDecimal monto;

    private String moneda;
    @Size(max=255)
    private String descripcion;
}
