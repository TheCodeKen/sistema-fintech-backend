package com.fintech.msprestamos.dto;
import lombok.AllArgsConstructor;
import lombok.Data;
@Data @AllArgsConstructor
public class AuditoriaRequest {
    private String accion;
    private String entidadAfectada;
    private Long entidadId;
    private String detalles;
}
