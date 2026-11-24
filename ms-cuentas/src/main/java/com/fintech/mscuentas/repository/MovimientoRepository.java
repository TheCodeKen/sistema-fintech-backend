package com.fintech.mscuentas.repository;
import com.fintech.mscuentas.entity.MovimientoAplicado;
import org.springframework.data.jpa.repository.JpaRepository;
public interface MovimientoRepository extends JpaRepository<MovimientoAplicado,String> {}
