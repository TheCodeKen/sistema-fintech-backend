package com.fintech.mscuentas.entity;
import jakarta.persistence.*;
import lombok.*;
@Entity @Table(name="movimientos_aplicados") @Getter @Setter @NoArgsConstructor
public class MovimientoAplicado {
    @Id @Column(length=120) private String operacionId;
    @Column(nullable=false,length=255) private String huella;
    public MovimientoAplicado(String id, String huella) { this.operacionId=id; this.huella=huella; }
}
