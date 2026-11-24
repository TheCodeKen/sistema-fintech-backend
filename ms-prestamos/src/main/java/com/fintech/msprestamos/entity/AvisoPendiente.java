package com.fintech.msprestamos.entity;
import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;
@Entity @Table(name="avisos_pendientes") @Getter @Setter @NoArgsConstructor
public class AvisoPendiente {
    @Id @Column(length=180) private String clave;
    @Column(name="usuario_id",nullable=false) private Long usuarioId;
    @Column(nullable=false,length=40) private String tipo;
    @Column(name="recurso_id",nullable=false) private Long recursoId;
    @Column(nullable=false,length=120) private String titulo;
    @Column(nullable=false,length=600) private String mensaje;
    @Column(name="fecha_evento",nullable=false) private LocalDateTime fechaEvento;
    @Column(name="fecha_entrega") private LocalDateTime fechaEntrega;
}
