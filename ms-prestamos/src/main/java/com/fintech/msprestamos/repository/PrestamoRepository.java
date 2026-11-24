package com.fintech.msprestamos.repository;

import com.fintech.msprestamos.entity.Prestamo;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

@Repository
public interface PrestamoRepository extends JpaRepository<Prestamo, Long> {
    Page<Prestamo> findByUsuarioIdAndIdNot(Long usuarioId, Long id, Pageable pageable);
    @org.springframework.data.jpa.repository.Query(value="select id from prestamos where estado in ('DESEMBOLSADO','VENCIDO') order by id",nativeQuery=true)
    List<Long> idsActivos();
    long countByCuentaDesembolsoIdAndEstadoNotIn(Long cuentaId, java.util.Collection<Prestamo.EstadoPrestamo> estados);
    @org.springframework.data.jpa.repository.Lock(jakarta.persistence.LockModeType.PESSIMISTIC_WRITE)
    @org.springframework.data.jpa.repository.Query("select p from Prestamo p where p.id = :id")
    java.util.Optional<Prestamo> bloquearPorId(@org.springframework.data.repository.query.Param("id") Long id);
    List<Prestamo> findByUsuarioId(Long usuarioId);
    List<Prestamo> findByEstado(Prestamo.EstadoPrestamo estado);
    Page<Prestamo> findByEstado(Prestamo.EstadoPrestamo estado, Pageable pageable);
    Page<Prestamo> findByUsuarioId(Long usuarioId, Pageable pageable);
    Page<Prestamo> findByEstadoAndUsuarioId(Prestamo.EstadoPrestamo estado, Long usuarioId, Pageable pageable);
    Page<Prestamo> findByMontoSolicitadoBetween(java.math.BigDecimal minimo, java.math.BigDecimal maximo, Pageable pageable);
    Page<Prestamo> findByEstadoAndMontoSolicitadoBetween(Prestamo.EstadoPrestamo estado, java.math.BigDecimal minimo, java.math.BigDecimal maximo, Pageable pageable);
    Page<Prestamo> findByUsuarioIdAndMontoSolicitadoBetween(Long usuarioId, java.math.BigDecimal minimo, java.math.BigDecimal maximo, Pageable pageable);
    Page<Prestamo> findByEstadoAndUsuarioIdAndMontoSolicitadoBetween(Prestamo.EstadoPrestamo estado, Long usuarioId, java.math.BigDecimal minimo, java.math.BigDecimal maximo, Pageable pageable);
    boolean existsByNumeroPrestamo(String numeroPrestamo);
    long countByEstado(Prestamo.EstadoPrestamo estado);
    @org.springframework.data.jpa.repository.Query("select coalesce(sum(p.montoAprobado), 0) from Prestamo p where p.estado = :estado")
    java.math.BigDecimal sumMontoByEstado(@org.springframework.data.repository.query.Param("estado") Prestamo.EstadoPrestamo estado);
}
