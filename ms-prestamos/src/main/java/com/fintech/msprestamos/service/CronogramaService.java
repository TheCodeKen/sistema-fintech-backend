package com.fintech.msprestamos.service;

import com.fintech.msprestamos.entity.*;
import com.fintech.msprestamos.repository.*;
import com.fintech.msprestamos.dto.PrestamoDetalleResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.*;
import java.util.*;

/** Called within the transaction holding the loan row lock. */
@Service @RequiredArgsConstructor
public class CronogramaService {
    private final CuotaRepository cuotas;
    private final PagoRepository pagos;
    private final Clock reloj;

    public List<CuotaPrestamo> preparar(Prestamo p) {
        var existentes=cuotas.findByPrestamoIdOrderByNumeroAsc(p.getId());
        if(!existentes.isEmpty()) return existentes;
        if(!activo(p) && p.getEstado()!=Prestamo.EstadoPrestamo.PAGADO) return List.of();
        var historicos=pagos.findByPrestamoIdOrderByFechaPagoAscClaveAsc(p.getId());
        BigDecimal abonado=historicos.stream().map(PagoAplicado::getMonto).filter(Objects::nonNull).reduce(BigDecimal.ZERO,BigDecimal::add);
        BigDecimal total=p.getSaldoPendiente().add(abonado);
        if(total.signum()<=0 || p.getPlazoMeses()==null || p.getPlazoMeses()<=0) return List.of();
        LocalDate inicio=p.getFechaDesembolso();
        if(inicio==null && p.getFechaVencimiento()!=null) inicio=p.getFechaVencimiento().minusMonths(p.getPlazoMeses());
        if(inicio==null) return List.of();
        BigDecimal base=total.divide(BigDecimal.valueOf(p.getPlazoMeses()),2,RoundingMode.DOWN);
        var nuevas=new ArrayList<CuotaPrestamo>();
        BigDecimal restantePagado=abonado;
        for(int n=1;n<=p.getPlazoMeses();n++) {
            var c=new CuotaPrestamo(); c.setPrestamoId(p.getId());c.setNumero(n);
            c.setVencimiento(inicio.plusMonths(n));
            c.setImporte(n==p.getPlazoMeses() ? total.subtract(base.multiply(BigDecimal.valueOf(n-1))) : base);
            BigDecimal aplicado=restantePagado.min(c.getImporte());
            c.setPagado(aplicado);restantePagado=restantePagado.subtract(aplicado);nuevas.add(c);
        }
        return cuotas.saveAll(nuevas);
    }

    public void validarSaldo(Prestamo p,List<CuotaPrestamo> plan) {
        BigDecimal saldo=plan.stream().map(CuotaPrestamo::pendiente).reduce(BigDecimal.ZERO,BigDecimal::add);
        if(plan.isEmpty() || saldo.compareTo(p.getSaldoPendiente())!=0)
            throw new ResponseStatusException(HttpStatus.CONFLICT,"El cronograma requiere conciliación antes de registrar pagos");
    }

    public void aplicar(List<CuotaPrestamo> plan,BigDecimal importe) {
        BigDecimal pendiente=importe;
        for(var c:plan) {
            BigDecimal aplicado=c.pendiente().min(pendiente);
            c.setPagado(c.getPagado().add(aplicado));pendiente=pendiente.subtract(aplicado);
            if(pendiente.signum()==0) break;
        }
        if(pendiente.signum()!=0) throw new IllegalStateException("Pago no distribuido completamente");
        cuotas.saveAll(plan);
    }

    public Prestamo.EstadoPrestamo estado(Prestamo p,List<CuotaPrestamo> plan) {
        if(!activo(p) && p.getEstado()!=Prestamo.EstadoPrestamo.PAGADO) return p.getEstado();
        if(p.getSaldoPendiente().signum()==0) return Prestamo.EstadoPrestamo.PAGADO;
        if(plan.isEmpty()) return p.getEstado();
        return plan.stream().anyMatch(this::vencida) ? Prestamo.EstadoPrestamo.VENCIDO : Prestamo.EstadoPrestamo.DESEMBOLSADO;
    }

    public PrestamoDetalleResponse detalle(Prestamo p,List<CuotaPrestamo> plan) {
        var historial=pagos.findByPrestamoIdOrderByFechaPagoAscClaveAsc(p.getId());
        var filas=plan.stream().map(c->new PrestamoDetalleResponse.Cuota(c.getNumero(),c.getVencimiento(),c.getImporte(),c.getPagado(),c.pendiente(),
                c.pendiente().signum()==0 ? "PAGADA" : vencida(c) ? "VENCIDA" : c.getPagado().signum()>0 ? "PARCIAL" : "PENDIENTE")).toList();
        BigDecimal pagado=historial.stream().map(PagoAplicado::getMonto).filter(Objects::nonNull).reduce(BigDecimal.ZERO,BigDecimal::add);
        BigDecimal total=plan.isEmpty() ? (p.getEstado()==Prestamo.EstadoPrestamo.CANCELADO || p.getEstado()==Prestamo.EstadoPrestamo.RECHAZADO ? BigDecimal.ZERO : p.getSaldoPendiente().add(pagado))
                : plan.stream().map(CuotaPrestamo::getImporte).reduce(BigDecimal.ZERO,BigDecimal::add);
        BigDecimal vencido=plan.stream().filter(this::vencida).map(CuotaPrestamo::pendiente).reduce(BigDecimal.ZERO,BigDecimal::add);
        var proxima=plan.stream().filter(c->c.pendiente().signum()>0).findFirst();
        String aviso=null;
        if((activo(p) || p.getEstado()==Prestamo.EstadoPrestamo.PAGADO) && p.getFechaDesembolso()==null)
            aviso=plan.isEmpty() ? "Los datos históricos no permiten reconstruir el cronograma completo. Se requiere conciliación."
                : "Cronograma histórico reconstruido desde el vencimiento registrado. Las fechas originales de algunos pagos no están disponibles.";
        return new PrestamoDetalleResponse(com.fintech.msprestamos.dto.PrestamoResponse.from(p),total,pagado,vencido,
                proxima.map(CuotaPrestamo::getVencimiento).orElse(null),proxima.map(CuotaPrestamo::pendiente).orElse(BigDecimal.ZERO),
                (int)plan.stream().filter(c->c.pendiente().signum()==0).count(),(int)plan.stream().filter(this::vencida).count(),filas,
                historial.stream().map(h->new PrestamoDetalleResponse.Pago(h.getClave(),h.getCuentaId(),h.getMonto(),h.getFechaPago(),h.getTransaccionId(),h.getFechaPago()==null)).toList(),aviso);
    }
    private boolean vencida(CuotaPrestamo c) {return c.pendiente().signum()>0 && c.getVencimiento().isBefore(LocalDate.now(reloj));}
    private boolean activo(Prestamo p) {return p.getEstado()==Prestamo.EstadoPrestamo.DESEMBOLSADO || p.getEstado()==Prestamo.EstadoPrestamo.VENCIDO;}
}
