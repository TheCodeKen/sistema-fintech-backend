package com.fintech.mstransacciones.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "alertas")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Alerta {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Enumerated(EnumType.STRING)
    @Column(name = "tipo_alerta", nullable = false, length = 50)
    private TipoAlerta tipoAlerta;

    @Enumerated(EnumType.STRING)
    @Column(name = "nivel_riesgo", nullable = false, length = 15)
    private NivelRiesgo nivelRiesgo;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 15)
    private EstadoAlerta estado;

    @Column(name = "numero_cuenta", nullable = false, length = 20)
    private String numeroCuenta;

    @Column(name = "transaccion_id")
    private Long transaccionId;

    @Column(nullable = false, length = 1000)
    private String descripcion;

    @Column(name = "observacion_resolucion", length = 1000)
    private String observacionResolucion;

    @Column(name = "fecha_deteccion", nullable = false)
    private LocalDateTime fechaDeteccion;

    @Column(name = "fecha_resolucion")
    private LocalDateTime fechaResolucion;

    @PrePersist
    void prePersist() {
        if (fechaDeteccion == null) fechaDeteccion = LocalDateTime.now();
        if (estado == null) estado = EstadoAlerta.PENDIENTE;
    }

    public enum TipoAlerta {
        MONTO_ELEVADO, TRANSACCION_REPETITIVA, CUENTA_NUEVA_CON_ALTO_MOVIMIENTO, INTENTOS_FALLIDOS
    }

    public enum NivelRiesgo { BAJO, MEDIO, ALTO, CRITICO }
    public enum EstadoAlerta { PENDIENTE, EN_REVISION, RESUELTA, DESCARTADA }
}
