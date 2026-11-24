package com.fintech.msprestamos.entity;
import jakarta.persistence.*;
import lombok.*;
@Entity @Table(name="pagos_aplicados") @Getter @Setter @NoArgsConstructor
public class PagoAplicado {
    @Id @Column(length=120) private String clave;
    @Column(name="prestamo_id") private Long prestamoId;
    @Column(name="cuenta_id") private Long cuentaId;
    @Column(precision=15,scale=2) private java.math.BigDecimal monto;
    @Column(name="fecha_pago") private java.time.LocalDateTime fechaPago;
    @Column(name="transaccion_id") private Long transaccionId;
    @Column(nullable=false,length=200) private String huella;
    public PagoAplicado(String clave,String huella) { this.clave=clave; this.huella=huella; }
}
