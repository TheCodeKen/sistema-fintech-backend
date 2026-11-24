package com.fintech.msusuarios.controller;
import com.fintech.msusuarios.dto.UsuariosMetricasResponse;
import com.fintech.msusuarios.repository.UsuarioRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;

@RestController
@RequestMapping("/api/usuarios/metricas")
@RequiredArgsConstructor
public class MetricasController {
    private final UsuarioRepository repository;
    @GetMapping
    public ResponseEntity<UsuariosMetricasResponse> obtener() {
        return ResponseEntity.ok(UsuariosMetricasResponse.builder()
                .activos(repository.countByActivoTrue())
                .inactivos(repository.countByActivoFalse())
                .registradosHoy(repository.countByFechaRegistroGreaterThanEqual(
                        LocalDate.now(ZoneId.of("America/Lima")).atStartOfDay()))
                .build());
    }
}
