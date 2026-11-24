package com.fintech.msprestamos.client;
import com.fintech.msprestamos.dto.AuditoriaRequest;
import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.*;
@FeignClient(name = "ms-auditoria", url = "${services.auditoria.url}")
public interface AuditoriaFeignClient {
    @PostMapping("/api/auditoria/internal")
    void registrar(@RequestBody AuditoriaRequest request);
}
