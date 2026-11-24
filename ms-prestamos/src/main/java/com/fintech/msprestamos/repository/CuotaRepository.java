package com.fintech.msprestamos.repository;
import com.fintech.msprestamos.entity.CuotaPrestamo;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
public interface CuotaRepository extends JpaRepository<CuotaPrestamo,Long> {
    List<CuotaPrestamo> findByPrestamoIdOrderByNumeroAsc(Long prestamoId);
}
