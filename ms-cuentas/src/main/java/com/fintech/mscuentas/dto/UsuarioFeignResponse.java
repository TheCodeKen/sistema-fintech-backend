package com.fintech.mscuentas.dto;

import lombok.Data;

@Data
public class UsuarioFeignResponse {
    private Long id;
    private String rol;
    private Boolean activo;
}
