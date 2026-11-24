package com.fintech.mstransacciones.entity;
import jakarta.persistence.*;
import lombok.*;
@Entity @Table(name="eventos_pendientes") @Getter @Setter @NoArgsConstructor
public class EventoPendiente {
    @Id @Column(length=64) private String eventoId;
    @Column(nullable=false,length=150) private String usuarioEjecutor;
    @Column(nullable=false,length=30) private String rolEjecutor;
    @Column(nullable=false,length=80) private String accion;
    @Column(nullable=false,length=40) private String entidadAfectada;
    @Column(nullable=false) private Long entidadId;
    @Column(length=2000) private String detalles;
    @Column(nullable=false) private java.time.LocalDateTime fechaRegistro;
}
