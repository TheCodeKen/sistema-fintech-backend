package com.fintech.msusuarios.service;

import com.fintech.msusuarios.dto.EventoAuditoria;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.Objects;

@Service
@RequiredArgsConstructor
public class ColaAuditoria {
    private final JdbcTemplate jdbc;
    @Transactional
    public void recibir(EventoAuditoria evento) {
        LocalDateTime fecha=evento.fechaRegistro().truncatedTo(ChronoUnit.MICROS);
        jdbc.update("""
            INSERT INTO eventos_pendientes (evento_id,usuario_ejecutor,rol_ejecutor,accion,entidad_afectada,entidad_id,detalles,fecha_registro,ip_origen)
            VALUES (?,?,?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE evento_id=evento_id
            """,evento.eventoId(),evento.usuarioEjecutor(),evento.rolEjecutor(),evento.accion(),evento.entidadAfectada(),
                evento.entidadId(),evento.detalles(),fecha,evento.ipOrigen());
        EventoAuditoria guardado=jdbc.queryForObject("SELECT * FROM eventos_pendientes WHERE evento_id=? FOR UPDATE",
            (r,n)->new EventoAuditoria(r.getString("evento_id"),r.getString("usuario_ejecutor"),r.getString("rol_ejecutor"),
                r.getString("accion"),r.getString("entidad_afectada"),r.getLong("entidad_id"),r.getString("detalles"),
                r.getObject("fecha_registro",LocalDateTime.class),r.getString("ip_origen")),evento.eventoId());
        var normalizado=new EventoAuditoria(evento.eventoId(),evento.usuarioEjecutor(),evento.rolEjecutor(),evento.accion(),
            evento.entidadAfectada(),evento.entidadId(),evento.detalles(),fecha,evento.ipOrigen());
        if(!Objects.equals(guardado,normalizado))
            throw new ResponseStatusException(HttpStatus.CONFLICT,"El identificador del evento ya tiene otro contenido.");
    }
}
