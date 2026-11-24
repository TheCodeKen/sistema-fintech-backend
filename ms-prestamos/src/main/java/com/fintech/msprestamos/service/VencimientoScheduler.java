package com.fintech.msprestamos.service;
import com.fintech.msprestamos.repository.PrestamoRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
@Component @RequiredArgsConstructor @Slf4j
public class VencimientoScheduler {
    private final PrestamoRepository repository;
    private final PrestamoService service;
    @Scheduled(fixedDelayString="${app.prestamos.vencimientos-ms:60000}",initialDelayString="${app.prestamos.vencimientos-inicio-ms:15000}")
    public void actualizar() {
        for(Long id:repository.idsActivos()) {
            try {service.actualizarVencimiento(id);}
            catch(RuntimeException ex) {log.warn("No se pudo revisar el vencimiento del préstamo {}",id,ex);}
        }
    }
}
