package com.fintech.msusuarios.repository;

import com.fintech.msusuarios.entity.Notificacion;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.domain.*;
import org.springframework.data.repository.query.Param;
import java.time.LocalDateTime;

public interface NotificacionRepository extends JpaRepository<Notificacion,Long> {
    Page<Notificacion> findByUsuarioId(Long usuarioId,Pageable page);
    Page<Notificacion> findByUsuarioIdAndLeidaEnIsNull(Long usuarioId,Pageable page);
    long countByUsuarioIdAndLeidaEnIsNull(Long usuarioId);
    boolean existsByIdAndUsuarioId(Long id,Long usuarioId);
    @Modifying @Query("update Notificacion n set n.leidaEn=:fecha where n.id=:id and n.usuarioId=:usuario and n.leidaEn is null")
    int leer(@Param("id") Long id,@Param("usuario") Long usuario,@Param("fecha") LocalDateTime fecha);
    @Modifying @Query("update Notificacion n set n.leidaEn=:fecha where n.usuarioId=:usuario and n.id<=:hasta and n.leidaEn is null")
    int leerTodas(@Param("usuario") Long usuario,@Param("hasta") Long hasta,@Param("fecha") LocalDateTime fecha);
    @Modifying @Query(value="""
        INSERT INTO notificaciones(clave,usuario_id,tipo,recurso_id,titulo,mensaje,fecha_evento)
        VALUES(:clave,:usuario,:tipo,:recurso,:titulo,:mensaje,:fecha)
        ON DUPLICATE KEY UPDATE clave=clave
        """,nativeQuery=true)
    int recibir(@Param("clave") String clave,@Param("usuario") Long usuario,@Param("tipo") String tipo,
            @Param("recurso") Long recurso,@Param("titulo") String titulo,@Param("mensaje") String mensaje,@Param("fecha") LocalDateTime fecha);
}
