package com.fintech.msauditoria.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

@Entity
@Table(name = "auditoria", indexes = {
        @Index(name = "idx_auditoria_fecha", columnList = "fecha_registro"),
        @Index(name = "idx_auditoria_entidad", columnList = "entidad_afectada, entidad_id")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Auditoria {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(name="evento_id",unique=true,nullable=false,length=64)
    private String eventoId;
    @Column(name="legacy_id",unique=true)
    private Long legacyId;

    @Column(name = "usuario_ejecutor", nullable = false, length = 150)
    private String usuarioEjecutor;

    @Column(name = "rol_ejecutor", nullable = false, length = 30)
    private String rolEjecutor;

    @Column(nullable = false, length = 80)
    private String accion;

    @Column(name = "entidad_afectada", nullable = false, length = 40)
    private String entidadAfectada;

    @Column(name = "entidad_id", nullable = false)
    private Long entidadId;

    @Column(length = 2000)
    private String detalles;

    @Column(name = "fecha_registro", nullable = false)
    private LocalDateTime fechaRegistro;

    @Column(name = "ip_origen", length = 45)
    private String ipOrigen;

    @PrePersist
    void prePersist() {
        if (fechaRegistro == null) fechaRegistro = LocalDateTime.now();
    }
}
