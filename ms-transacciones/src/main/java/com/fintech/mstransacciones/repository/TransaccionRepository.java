package com.fintech.mstransacciones.repository;

import com.fintech.mstransacciones.entity.Transaccion;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.time.LocalDateTime;
import java.math.BigDecimal;

@Repository
public interface TransaccionRepository extends JpaRepository<Transaccion, Long> {
    @org.springframework.data.jpa.repository.Lock(jakarta.persistence.LockModeType.PESSIMISTIC_WRITE)
    java.util.Optional<Transaccion> findByOperacionId(String operacionId);
    @org.springframework.data.jpa.repository.Lock(jakarta.persistence.LockModeType.PESSIMISTIC_WRITE)
    @Query("select t from Transaccion t where t.id = :id")
    java.util.Optional<Transaccion> bloquearPorId(@Param("id") Long id);
    List<Transaccion> findByCuentaOrigenIdOrCuentaDestinoId(Long cuentaOrigenId, Long cuentaDestinoId);
    List<Transaccion> findByCuentaOrigenId(Long cuentaOrigenId);

    @Query("""
        select t from Transaccion t
        where (:tipo is null or t.tipoTransaccion = :tipo)
          and (:estado is null or t.estado = :estado)
          and (:cuenta is null or t.cuentaOrigenId = :cuenta or t.cuentaDestinoId = :cuenta)
          and (:desde is null or t.fechaTransaccion >= :desde)
          and (:hasta is null or t.fechaTransaccion < :hasta)
        """)
    Page<Transaccion> buscar(@Param("tipo") Transaccion.TipoTransaccion tipo,
                             @Param("estado") Transaccion.EstadoTransaccion estado,
                             @Param("cuenta") Long cuenta,
                             @Param("desde") LocalDateTime desde,
                             @Param("hasta") LocalDateTime hasta,
                             Pageable pageable);

    boolean existsByTransaccionPadreIdAndTipoTransaccion(Long padreId, Transaccion.TipoTransaccion tipo);
    java.util.Optional<Transaccion> findFirstByTransaccionPadreIdAndTipoTransaccion(Long padreId, Transaccion.TipoTransaccion tipo);
    @Query("""
        select count(t) from Transaccion t
        where t.cuentaOrigenId = :origen and t.cuentaDestinoId = :destino
          and t.tipoTransaccion = :tipo and t.fechaTransaccion >= :desde
        """)
    long countRepetitivas(@Param("origen") Long origen, @Param("destino") Long destino,
                          @Param("tipo") Transaccion.TipoTransaccion tipo,
                          @Param("desde") LocalDateTime desde);
    @Query("""
        select count(t) from Transaccion t
        where t.cuentaOrigenId = :origen and t.estado = :estado and t.fechaTransaccion >= :desde
        """)
    long countPorEstadoDesde(@Param("origen") Long origen,
                             @Param("estado") Transaccion.EstadoTransaccion estado,
                             @Param("desde") LocalDateTime desde);
    @Query("select count(t) from Transaccion t where t.fechaTransaccion >= :desde and t.fechaTransaccion < :hasta")
    long countEntre(@Param("desde") LocalDateTime desde, @Param("hasta") LocalDateTime hasta);
    @Query("select coalesce(sum(t.monto), 0) from Transaccion t where t.fechaTransaccion >= :desde and t.fechaTransaccion < :hasta and t.estado = :estado")
    BigDecimal sumMontoHoy(@Param("desde") LocalDateTime desde, @Param("hasta") LocalDateTime hasta,
                           @Param("estado") Transaccion.EstadoTransaccion estado);
    @Query("select t.tipoTransaccion, count(t) from Transaccion t where t.fechaTransaccion >= :desde and t.fechaTransaccion < :hasta group by t.tipoTransaccion")
    List<Object[]> contarTipos(@Param("desde") LocalDateTime desde, @Param("hasta") LocalDateTime hasta);
}
