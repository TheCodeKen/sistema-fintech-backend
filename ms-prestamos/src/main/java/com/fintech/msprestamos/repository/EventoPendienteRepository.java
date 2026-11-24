package com.fintech.msprestamos.repository;
import com.fintech.msprestamos.entity.EventoPendiente;
import org.springframework.data.jpa.repository.JpaRepository;
public interface EventoPendienteRepository extends JpaRepository<EventoPendiente,String> {
    java.util.List<EventoPendiente> findTop50ByOrderByFechaRegistroAsc();
}
