package com.fintech.mscuentas.repository;
import com.fintech.mscuentas.entity.EventoPendiente;
import org.springframework.data.jpa.repository.JpaRepository;
public interface EventoPendienteRepository extends JpaRepository<EventoPendiente,String> {
    java.util.List<EventoPendiente> findTop50ByOrderByFechaRegistroAsc();
}
