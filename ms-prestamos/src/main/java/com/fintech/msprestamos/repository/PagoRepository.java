package com.fintech.msprestamos.repository;
import com.fintech.msprestamos.entity.PagoAplicado;
import org.springframework.data.jpa.repository.JpaRepository;
public interface PagoRepository extends JpaRepository<PagoAplicado,String> {
    java.util.List<PagoAplicado> findByPrestamoIdOrderByFechaPagoAscClaveAsc(Long prestamoId);
}
