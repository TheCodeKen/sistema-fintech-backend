package com.fintech.msusuarios.service;

import com.fintech.msusuarios.dto.*;
import com.fintech.msusuarios.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.*;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import java.time.*;

@Service @RequiredArgsConstructor
public class NotificacionService {
    private final NotificacionRepository repository;
    private final UsuarioRepository usuarios;
    private Long usuarioActual(){
        var auth=SecurityContextHolder.getContext().getAuthentication();
        if(auth==null || !auth.isAuthenticated() || !(auth.getDetails() instanceof Number n))
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED,"Se requiere una sesión válida");
        return n.longValue(); // Admins also see only their own inbox.
    }
    @Transactional(readOnly=true)
    public Page<NotificacionResponse> listar(boolean noLeidas,int page,int size){
        if(page<0 || size<1 || size>50)throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Página o tamaño inválido (1 a 50)");
        Long uid=usuarioActual();Pageable p=PageRequest.of(page,size,Sort.by(Sort.Direction.DESC,"id"));
        return (noLeidas ? repository.findByUsuarioIdAndLeidaEnIsNull(uid,p) : repository.findByUsuarioId(uid,p)).map(NotificacionResponse::from);
    }
    @Transactional(readOnly=true)
    public long noLeidas(){return repository.countByUsuarioIdAndLeidaEnIsNull(usuarioActual());}
    @Transactional
    public void leer(Long id){
        Long uid=usuarioActual();
        int updated=repository.leer(id,uid,LocalDateTime.now(ZoneId.of("America/Lima")));
        if(updated==0 && !repository.existsByIdAndUsuarioId(id,uid))throw new ResponseStatusException(HttpStatus.NOT_FOUND,"Notificación no encontrada");
    }
    @Transactional
    public void leerTodas(Long hastaId){repository.leerTodas(usuarioActual(),hastaId,LocalDateTime.now(ZoneId.of("America/Lima")));}
    @Transactional
    public void recibir(NotificacionEvento e){
        // Events for a physically deleted user must not block the producer's delivery queue.
        if(!usuarios.existsById(e.usuarioId()))return;
        repository.recibir(e.clave(),e.usuarioId(),e.tipo().name(),e.recursoId(),e.titulo(),e.mensaje(),e.fechaEvento());
    }
}
