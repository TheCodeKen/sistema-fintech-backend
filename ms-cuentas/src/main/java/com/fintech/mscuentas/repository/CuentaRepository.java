package com.fintech.mscuentas.repository;

import com.fintech.mscuentas.entity.Cuenta;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.Optional;
import java.math.BigDecimal;
import com.fintech.mscuentas.entity.Cuenta.EstadoCuenta;

@Repository
public interface CuentaRepository extends JpaRepository<Cuenta, Long> {
    @org.springframework.data.jpa.repository.Lock(jakarta.persistence.LockModeType.PESSIMISTIC_WRITE)
    @Query("select c from Cuenta c where c.id = :id")
    Optional<Cuenta> bloquearPorId(@Param("id") Long id);
    List<Cuenta> findByUsuarioId(Long usuarioId);

    @Query("""
        select c from Cuenta c
        where (:moneda is null or c.moneda = :moneda)
          and (:estado is null or c.estado = :estado)
          and (:numeroCuenta is null or lower(c.numeroCuenta) like lower(concat('%', :numeroCuenta, '%')))
        """)
    Page<Cuenta> buscar(@Param("moneda") String moneda,
                        @Param("estado") Cuenta.EstadoCuenta estado,
                        @Param("numeroCuenta") String numeroCuenta,
                        Pageable pageable);
    Optional<Cuenta> findByNumeroCuenta(String numeroCuenta);
    boolean existsByNumeroCuenta(String numeroCuenta);
    long countByEstado(EstadoCuenta estado);
    @Query("select coalesce(sum(c.saldo), 0) from Cuenta c where c.moneda = :moneda")
    BigDecimal totalSaldoPorMoneda(@Param("moneda") String moneda);
}
