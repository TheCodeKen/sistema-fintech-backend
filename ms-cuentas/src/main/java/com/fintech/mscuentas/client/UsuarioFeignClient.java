package com.fintech.mscuentas.client;

import com.fintech.mscuentas.dto.UsuarioFeignResponse;
import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;

@FeignClient(name = "ms-usuarios", url = "${services.usuarios.url:http://localhost:8081}")
public interface UsuarioFeignClient {
    @GetMapping("/api/usuarios/{id}")
    UsuarioFeignResponse buscarPorId(@PathVariable("id") Long id);
}
