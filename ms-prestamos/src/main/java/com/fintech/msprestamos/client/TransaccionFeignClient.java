package com.fintech.msprestamos.client;

import com.fintech.msprestamos.dto.TransaccionClientRequest;
import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;

@FeignClient(name = "ms-transacciones", url = "${feign.client.ms-transacciones.url}")
public interface TransaccionFeignClient {
    @PostMapping("/api/transacciones")
    com.fintech.msprestamos.dto.TransaccionResultado crear(@RequestBody TransaccionClientRequest request,
            @org.springframework.web.bind.annotation.RequestHeader("Idempotency-Key") String clave);
}
