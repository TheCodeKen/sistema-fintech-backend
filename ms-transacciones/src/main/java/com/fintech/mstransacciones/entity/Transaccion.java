package com.fintech.mstransacciones.entity;

import jakarta.persistence.*;
import lombok.*;
import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "transacciones")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Transaccion {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(name="operacion_id", unique=true, length=120)
    private String operacionId;
    @Column(length=64)
    private String huella;

    @Column(name = "cuenta_origen_id", nullable = false)
    private Long cuentaOrigenId;

    @Column(name = "cuenta_destino_id")
    private Long cuentaDestinoId;
    @Column(name="usuario_origen_id") private Long usuarioOrigenId;
    @Column(name="usuario_destino_id") private Long usuarioDestinoId;

    @Column(name = "transaccion_padre_id")
    private Long transaccionPadreId;

    @Enumerated(EnumType.STRING)
    @Column(name = "tipo_transaccion", nullable = false)
    private TipoTransaccion tipoTransaccion;

    @Column(nullable = false, precision = 15, scale = 2)
    private BigDecimal monto;

    @Column(length = 3)
    private String moneda;

    @Column(length = 255)
    private String descripcion;

    @Enumerated(EnumType.STRING)
    private EstadoTransaccion estado;

    @Column(name = "fecha_transaccion")
    private LocalDateTime fechaTransaccion;

    @Column(name = "numero_referencia", unique = true, length = 30)
    private String numeroReferencia;

    @PrePersist
    public void prePersist() {
        this.fechaTransaccion = LocalDateTime.now();
        if (this.estado == null) this.estado = EstadoTransaccion.PENDIENTE;
        if (this.moneda == null) this.moneda = "PEN";
        this.numeroReferencia = "TXN" + java.util.UUID.randomUUID().toString().replace("-", "").substring(0,24);
    }

    public enum TipoTransaccion {
        DEPOSITO, RETIRO, TRANSFERENCIA, PAGO, DESEMBOLSO_PRESTAMO, PAGO_PRESTAMO, REVERSION
    }

    public enum EstadoTransaccion {
        PENDIENTE, PROCESANDO, COMPLETADA, FALLIDA, CANCELADA, REVERTIDA
    }
}
