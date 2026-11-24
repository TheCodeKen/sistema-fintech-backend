package com.fintech.mstransacciones.service;
import com.fintech.mstransacciones.repository.AvisoPendienteRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.*;
import java.time.*;
import java.util.Map;
@Service @RequiredArgsConstructor @Slf4j
public class NotificacionOutbox {
    private final AvisoPendienteRepository repository;
    @Value("${services.usuarios.url:http://localhost:8081}") private String url;
    @Value("${app.internal.service-key}") private String key;
    @Transactional(propagation=Propagation.MANDATORY)
    public void registrar(String clave,Long usuarioId,String tipo,Long recursoId,String titulo,String mensaje){
        repository.registrar(clave,usuarioId,tipo,recursoId,titulo,mensaje,LocalDateTime.now(ZoneId.of("America/Lima")));
    }
    @Scheduled(fixedDelayString="${app.notificaciones.retry-ms:5000}")
    public void publicar(){
        for(var e:repository.findTop50ByFechaEntregaIsNullOrderByFechaEventoAscClaveAsc()){
            try{
                com.fintech.mstransacciones.config.HttpClients.create(url).post().uri("/api/usuarios/notificaciones/internal/eventos")
                    .header("X-Internal-Service",key).body(Map.of("clave",e.getClave(),"usuarioId",e.getUsuarioId(),
                        "tipo",e.getTipo(),"recursoId",e.getRecursoId(),"titulo",e.getTitulo(),"mensaje",e.getMensaje(),"fechaEvento",e.getFechaEvento()))
                    .retrieve().toBodilessEntity();
                repository.entregado(e.getClave(),LocalDateTime.now(ZoneId.of("America/Lima")));
            }catch(org.springframework.web.client.RestClientException ex){
                log.warn("Notificación pendiente de entrega: {}",e.getClave());break;
            }
        }
    }
}
