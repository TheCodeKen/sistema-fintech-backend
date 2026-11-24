package com.fintech.mstransacciones.repository;
import com.fintech.mstransacciones.entity.AvisoPendiente;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;
import java.time.LocalDateTime;
import java.util.List;
public interface AvisoPendienteRepository extends JpaRepository<AvisoPendiente,String> {
    List<AvisoPendiente> findTop50ByFechaEntregaIsNullOrderByFechaEventoAscClaveAsc();
    @Modifying @Query(value="""
        INSERT INTO avisos_pendientes(clave,usuario_id,tipo,recurso_id,titulo,mensaje,fecha_evento)
        VALUES(:clave,:usuario,:tipo,:recurso,:titulo,:mensaje,:fecha)
        ON DUPLICATE KEY UPDATE clave=clave
        """,nativeQuery=true)
    int registrar(@Param("clave") String clave,@Param("usuario") Long usuario,@Param("tipo") String tipo,
        @Param("recurso") Long recurso,@Param("titulo") String titulo,@Param("mensaje") String mensaje,@Param("fecha") LocalDateTime fecha);
    @Transactional @Modifying @Query("update AvisoPendiente a set a.fechaEntrega=:fecha where a.clave=:clave and a.fechaEntrega is null")
    int entregado(@Param("clave") String clave,@Param("fecha") LocalDateTime fecha);
}
