package com.fintech.msusuarios.repository;
import com.fintech.msusuarios.entity.EventoPendiente;
import org.springframework.data.jpa.repository.JpaRepository;
public interface EventoPendienteRepository extends JpaRepository<EventoPendiente,String> {
    java.util.List<EventoPendiente> findTop50ByOrderByFechaRegistroAsc();
}
