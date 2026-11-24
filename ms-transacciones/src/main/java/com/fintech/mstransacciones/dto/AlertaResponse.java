package com.fintech.mstransacciones.dto;

import com.fintech.mstransacciones.entity.Alerta;
import lombok.Builder;
import lombok.Value;
import java.time.LocalDateTime;

@Value
@Builder
public class AlertaResponse {
    Long id;
    String tipoAlerta;
    String nivelRiesgo;
    String estado;
    String numeroCuenta;
    Long transaccionId;
    String descripcion;
    String observacionResolucion;
    LocalDateTime fechaDeteccion;
    LocalDateTime fechaResolucion;

    public static AlertaResponse from(Alerta a) {
        return AlertaResponse.builder().id(a.getId()).tipoAlerta(a.getTipoAlerta().name())
                .nivelRiesgo(a.getNivelRiesgo().name()).estado(a.getEstado().name())
                .numeroCuenta(a.getNumeroCuenta()).transaccionId(a.getTransaccionId())
                .descripcion(a.getDescripcion()).observacionResolucion(a.getObservacionResolucion())
                .fechaDeteccion(a.getFechaDeteccion()).fechaResolucion(a.getFechaResolucion()).build();
    }
}
