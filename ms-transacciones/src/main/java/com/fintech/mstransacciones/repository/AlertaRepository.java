package com.fintech.mstransacciones.repository;

import com.fintech.mstransacciones.entity.Alerta;
import org.springframework.data.domain.*;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;
import java.time.LocalDateTime;

public interface AlertaRepository extends JpaRepository<Alerta, Long> {
    @Query("""
        select a from Alerta a
        where (:nivel is null or a.nivelRiesgo = :nivel)
          and (:estado is null or a.estado = :estado)
          and (:tipo is null or a.tipoAlerta = :tipo)
        """)
    Page<Alerta> buscar(@Param("nivel") Alerta.NivelRiesgo nivel,
                        @Param("estado") Alerta.EstadoAlerta estado,
                        @Param("tipo") Alerta.TipoAlerta tipo, Pageable pageable);

    long countByEstado(Alerta.EstadoAlerta estado);

    long countByNumeroCuentaAndTransaccionIdIsNotNullAndFechaDeteccionAfter(String numeroCuenta, LocalDateTime fecha);
}
