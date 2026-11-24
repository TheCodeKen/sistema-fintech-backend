package com.fintech.mstransacciones.repository;
import com.fintech.mstransacciones.entity.EventoPendiente;
import org.springframework.data.jpa.repository.JpaRepository;
public interface EventoPendienteRepository extends JpaRepository<EventoPendiente,String> {
    java.util.List<EventoPendiente> findTop50ByOrderByFechaRegistroAsc();
}
