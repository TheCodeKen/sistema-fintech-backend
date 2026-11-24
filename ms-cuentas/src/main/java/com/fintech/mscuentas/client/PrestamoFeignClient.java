package com.fintech.mscuentas.client;
import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.*;
@FeignClient(name="ms-prestamos-obligaciones",url="${services.prestamos.url:http://localhost:8084}")
public interface PrestamoFeignClient {
    @GetMapping("/api/prestamos/internal/obligaciones/{cuentaId}")
    long obligaciones(@PathVariable("cuentaId") Long cuentaId);
}
