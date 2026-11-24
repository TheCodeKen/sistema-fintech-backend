package com.fintech.msprestamos.entity;
import jakarta.persistence.*;
import lombok.*;
import java.math.BigDecimal;
import java.time.LocalDate;
@Entity @Table(name="cuotas_prestamo",uniqueConstraints=@UniqueConstraint(columnNames={"prestamo_id","numero"}))
@Getter @Setter @NoArgsConstructor
public class CuotaPrestamo {
    @Id @GeneratedValue(strategy=GenerationType.IDENTITY) private Long id;
    @Column(name="prestamo_id",nullable=false) private Long prestamoId;
    @Column(nullable=false) private Integer numero;
    @Column(nullable=false) private LocalDate vencimiento;
    @Column(nullable=false,precision=15,scale=2) private BigDecimal importe;
    @Column(nullable=false,precision=15,scale=2) private BigDecimal pagado;
    public BigDecimal pendiente() { return importe.subtract(pagado); }
}
