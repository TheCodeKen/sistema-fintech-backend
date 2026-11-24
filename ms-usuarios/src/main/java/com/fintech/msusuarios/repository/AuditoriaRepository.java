package com.fintech.msusuarios.repository;

import com.fintech.msusuarios.entity.Auditoria;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;

public interface AuditoriaRepository extends JpaRepository<Auditoria, Long> {
    java.util.Optional<Auditoria> findByEventoId(String eventoId);
    @Query("""
        select a from Auditoria a
        where (:accion is null or a.accion = :accion)
          and (:entidad is null or a.entidadAfectada = :entidad)
          and (:usuario is null or lower(a.usuarioEjecutor) like lower(concat('%', :usuario, '%')))
          and (:desde is null or a.fechaRegistro >= :desde)
          and (:hasta is null or a.fechaRegistro < :hasta)
        """)
    Page<Auditoria> buscar(@Param("accion") String accion,
                           @Param("entidad") String entidad,
                           @Param("usuario") String usuario,
                           @Param("desde") LocalDateTime desde,
                           @Param("hasta") LocalDateTime hasta,
                           Pageable pageable);
}
