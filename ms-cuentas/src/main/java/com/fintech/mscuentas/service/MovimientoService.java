package com.fintech.mscuentas.service;
import com.fintech.mscuentas.dto.MovimientoRequest;
import com.fintech.mscuentas.entity.*;
import com.fintech.mscuentas.repository.*;
import com.fintech.mscuentas.config.security.Acceso;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;
import java.math.BigDecimal;
import java.util.Objects;

@Service @RequiredArgsConstructor
public class MovimientoService {
    private final CuentaRepository cuentas;
    private final MovimientoRepository movimientos;
    
    @Transactional
    public void aplicar(MovimientoRequest r) {
        Acceso.soloInterno();
        if (r.delta().signum()==0 || Objects.equals(r.origenId(),r.destinoId()))
            throw error("Movimiento inválido");
        // Lock in a stable order, including both sides of a transfer.
        Long primero=r.destinoId()==null ? r.origenId() : Math.min(r.origenId(),r.destinoId());
        Long segundo=r.destinoId()==null ? null : Math.max(r.origenId(),r.destinoId());
        Cuenta a=bloquear(primero), b=segundo==null ? null : bloquear(segundo);
        String huella=r.origenId()+":"+r.destinoId()+":"+r.delta().stripTrailingZeros().toPlainString()+":"+r.moneda();
        var previo=movimientos.findById(r.operacionId());
        if (previo.isPresent()) {
            if (!huella.equals(previo.get().getHuella())) throw error("La clave de operación ya tiene otros datos");
            return;
        }
        Cuenta origen=Objects.equals(a.getId(),r.origenId()) ? a : b;
        Cuenta destino=r.destinoId()==null ? null : (Objects.equals(a.getId(),r.destinoId()) ? a : b);
        validar(origen,r.delta(),r.moneda());
        if (destino!=null) validar(destino,r.delta().negate(),r.moneda());
        origen.setSaldo(origen.getSaldo().add(r.delta()));
        if(destino!=null) destino.setSaldo(destino.getSaldo().subtract(r.delta()));
        movimientos.save(new MovimientoAplicado(r.operacionId(),huella));
    }
    private Cuenta bloquear(Long id) { return cuentas.bloquearPorId(id).orElseThrow(() -> error("Cuenta inexistente")); }
    private void validar(Cuenta c, BigDecimal delta, String moneda) {
        if(c.getEstado()!=Cuenta.EstadoCuenta.ACTIVA) throw error("La cuenta no está activa");
        if(!moneda.equals(c.getMoneda())) throw error("La moneda no coincide con la cuenta");
        BigDecimal saldo=c.getSaldo().add(delta);
        if(saldo.signum()<0 || saldo.precision()-saldo.scale()>13) throw error("Saldo insuficiente o fuera de rango");
    }
    private ResponseStatusException error(String s) { return new ResponseStatusException(HttpStatus.CONFLICT,s); }
}
