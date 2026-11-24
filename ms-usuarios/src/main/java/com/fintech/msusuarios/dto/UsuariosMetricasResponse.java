package com.fintech.msusuarios.dto;
import lombok.Builder;
import lombok.Value;
@Value @Builder
public class UsuariosMetricasResponse {
    long activos;
    long inactivos;
    long registradosHoy;
}
