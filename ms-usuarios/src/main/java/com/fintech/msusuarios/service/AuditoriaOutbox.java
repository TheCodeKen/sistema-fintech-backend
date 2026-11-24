package com.fintech.msusuarios.service;
import com.fintech.msusuarios.dto.AuditoriaRequest;
import com.fintech.msusuarios.entity.EventoPendiente;
import com.fintech.msusuarios.repository.EventoPendienteRepository;
import org.springframework.stereotype.Service;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.security.core.context.SecurityContextHolder;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
@Service @EnableScheduling @RequiredArgsConstructor @Slf4j
public class AuditoriaOutbox {
    private final EventoPendienteRepository repository;
    @Value("${services.auditoria.url:http://localhost:8085}") private String url;
    @Value("${app.internal.service-key}") private String key;
    @Scheduled(fixedDelayString="${app.auditoria.retry-ms:5000}")
    public void publicar() {
        for(var e: repository.findTop50ByOrderByFechaRegistroAsc()) {
            try {
                com.fintech.msusuarios.config.HttpClients.create(url).post().uri("/api/auditoria/internal/eventos")
                    .header("X-Internal-Service",key).body(e).retrieve().toBodilessEntity();
                repository.deleteById(e.getEventoId());
            } catch(org.springframework.web.client.RestClientException ex) {
                String estado=ex instanceof org.springframework.web.client.RestClientResponseException respuesta
                    ? Integer.toString(respuesta.getStatusCode().value()) : "SIN_RESPUESTA";
                log.warn("Auditoria pendiente: evento={} tipo={} estado={}",e.getEventoId(),ex.getClass().getSimpleName(),estado);
                break;
            }
        }
    }
}
