package com.fintech.mstransacciones.service;

import com.fintech.mstransacciones.client.CuentaClientDTO;
import com.fintech.mstransacciones.client.CuentaFeignClient;
import com.fintech.mstransacciones.client.AuditoriaFeignClient;
import com.fintech.mstransacciones.dto.AuditoriaRequest;
import com.fintech.mstransacciones.dto.TransaccionRequest;
import com.fintech.mstransacciones.dto.TransaccionResponse;
import com.fintech.mstransacciones.entity.Transaccion;
import com.fintech.mstransacciones.repository.TransaccionRepository;
import feign.FeignException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import com.fintech.mstransacciones.config.security.Acceso;
import com.fintech.mstransacciones.dto.MovimientoRequest;
import org.springframework.transaction.annotation.Transactional;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class TransaccionService {
    private final TransaccionRepository transaccionRepository;
    private final CuentaFeignClient cuentaFeignClient;
    private final AuditoriaOutbox auditoriaOutbox;
    private final AntifraudeService antifraudeService;
    private final NotificacionOutbox notificaciones;

    public com.fintech.mstransacciones.dto.RevisionMovimiento revisar(TransaccionRequest request) {
        if (!java.util.Set.of(Transaccion.TipoTransaccion.DEPOSITO, Transaccion.TipoTransaccion.RETIRO,
                Transaccion.TipoTransaccion.TRANSFERENCIA, Transaccion.TipoTransaccion.PAGO).contains(request.getTipoTransaccion()))
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Este movimiento requiere su flujo específico");
        CuentaClientDTO origen=resolverCuenta(request.getNumeroCuentaOrigen(),request.getCuentaOrigenId(),"origen");
        Acceso.propietario(origen.getUsuarioId());
        CuentaClientDTO destino=request.getTipoTransaccion()==Transaccion.TipoTransaccion.TRANSFERENCIA
                ? resolverCuenta(request.getNumeroCuentaDestino(),null,"destino") : null;
        validarOperacion(origen,destino,request);
        boolean credito=request.getTipoTransaccion()==Transaccion.TipoTransaccion.DEPOSITO;
        if(!credito && origen.getSaldo().compareTo(request.getMonto())<0)
            throw new ResponseStatusException(HttpStatus.CONFLICT,"El importe supera el saldo disponible");
        return new com.fintech.mstransacciones.dto.RevisionMovimiento(origen.getNumeroCuenta(),
                destino==null ? null : destino.getNumeroCuenta(),origen.getMoneda(),request.getMonto(),
                origen.getSaldo(),credito ? origen.getSaldo().add(request.getMonto()) : origen.getSaldo().subtract(request.getMonto()));
    }

    @Transactional(readOnly=true)
    public com.fintech.mstransacciones.dto.TransaccionDetalle detalle(Long id) {
        TransaccionResponse movimiento=buscarPorId(id); // Ownership is checked before loading related data.
        TransaccionResponse original=movimiento.getTransaccionPadreId()==null ? null : buscarPorId(movimiento.getTransaccionPadreId());
        TransaccionResponse reversion=transaccionRepository.findFirstByTransaccionPadreIdAndTipoTransaccion(id,Transaccion.TipoTransaccion.REVERSION)
                .map(this::construirRespuesta).orElse(null);
        return new com.fintech.mstransacciones.dto.TransaccionDetalle(movimiento,original,reversion);
    }

    public Page<TransaccionResponse> listarTodas(String tipo, String estado, String numeroCuenta,
                                                   String desde, String hasta, Pageable pageable) {
        Transaccion.TipoTransaccion tipoEnum = parseTipo(tipo);
        Transaccion.EstadoTransaccion estadoEnum = parseEstado(estado);
        Long cuentaId = resolverCuentaFiltro(numeroCuenta);
        LocalDateTime desdeDate = desde == null || desde.isBlank() ? null : LocalDate.parse(desde).atStartOfDay();
        LocalDateTime hastaDate = hasta == null || hasta.isBlank() ? null : LocalDate.parse(hasta).plusDays(1).atStartOfDay();
        return transaccionRepository.buscar(tipoEnum, estadoEnum, cuentaId, desdeDate, hastaDate, pageable)
                .map(this::construirRespuesta);
    }

    public List<TransaccionResponse> listarPorCuenta(Long cuentaId) {
        Acceso.lectura(cuentaFeignClient.obtenerCuentaPorId(cuentaId).getUsuarioId());
        return transaccionRepository.findByCuentaOrigenIdOrCuentaDestinoId(cuentaId, cuentaId)
                .stream().map(this::construirRespuesta).collect(Collectors.toList());
    }

    public TransaccionResponse buscarPorId(Long id) {
        Transaccion tx=obtener(id);
        if(!Acceso.admin() && !Acceso.interno()) {
            Long uid=cuentaFeignClient.obtenerCuentaPorId(tx.getCuentaOrigenId()).getUsuarioId();
            try { Acceso.propietario(uid); }
            catch(ResponseStatusException ex) {
                if(tx.getCuentaDestinoId()==null) throw ex;
                Acceso.propietario(cuentaFeignClient.obtenerCuentaPorId(tx.getCuentaDestinoId()).getUsuarioId());
            }
        }
        return construirRespuesta(tx);
    }

    @Transactional(isolation = org.springframework.transaction.annotation.Isolation.READ_COMMITTED,
            noRollbackFor = ResponseStatusException.class)
    public TransaccionResponse crear(TransaccionRequest request) {
        if (request.getOperacionId()==null || !request.getOperacionId().matches("[A-Za-z0-9:_-]{8,100}")
                || (!Acceso.interno() && request.getOperacionId().length()>64))
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Idempotency-Key inválida");
        var autenticacion=org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication();
        request.setOperacionId((Acceso.interno() ? "interno:" : "usuario:"+autenticacion.getDetails()+":")+request.getOperacionId());
        if(request.getTipoTransaccion()==Transaccion.TipoTransaccion.DESEMBOLSO_PRESTAMO
                || request.getTipoTransaccion()==Transaccion.TipoTransaccion.PAGO_PRESTAMO) Acceso.soloInterno();
        var previo=transaccionRepository.findByOperacionId(request.getOperacionId());
        if(previo.isPresent()) {
            Transaccion tx=previo.get();
            Acceso.lectura(cuentaFeignClient.obtenerCuentaPorId(tx.getCuentaOrigenId()).getUsuarioId());
            if(!huella(request).equals(tx.getHuella())) throw new ResponseStatusException(HttpStatus.CONFLICT,"La clave ya se utilizó con otros datos");
            if(tx.getEstado()==Transaccion.EstadoTransaccion.COMPLETADA || tx.getEstado()==Transaccion.EstadoTransaccion.REVERTIDA) return construirRespuesta(tx);
            if(tx.getEstado()==Transaccion.EstadoTransaccion.FALLIDA) throw new ResponseStatusException(HttpStatus.CONFLICT,"La operación fue rechazada; utilice una nueva clave");
            return ejecutar(tx,cuentaFeignClient.obtenerCuentaPorId(tx.getCuentaOrigenId()));
        }
        if (request.getTipoTransaccion() == Transaccion.TipoTransaccion.REVERSION) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Las reversiones solo pueden crearse mediante el endpoint administrativo");
        }
        CuentaClientDTO origen = resolverCuenta(request.getNumeroCuentaOrigen(), request.getCuentaOrigenId(), "origen");
        CuentaClientDTO destino = request.getTipoTransaccion() == Transaccion.TipoTransaccion.TRANSFERENCIA
                ? resolverCuenta(request.getNumeroCuentaDestino(), null, "destino") : null;
        if(!Acceso.interno()) Acceso.propietario(origen.getUsuarioId());
        validarOperacion(origen, destino, request);

        Transaccion tx = Transaccion.builder()
                .operacionId(request.getOperacionId()).huella(huella(request))
                .cuentaOrigenId(origen.getId())
                .cuentaDestinoId(destino == null ? null : destino.getId())
                .usuarioOrigenId(origen.getUsuarioId()).usuarioDestinoId(destino==null ? null : destino.getUsuarioId())
                .tipoTransaccion(request.getTipoTransaccion())
                .monto(request.getMonto())
                .moneda(origen.getMoneda())
                .descripcion(request.getDescripcion())
                .estado(Transaccion.EstadoTransaccion.PENDIENTE)
                .build();
        tx = transaccionRepository.save(tx);
        antifraudeService.evaluar(tx, origen, destino);
        return ejecutar(tx, origen);
    }

    private TransaccionResponse ejecutar(Transaccion tx, CuentaClientDTO origen) {
        asegurarDestinatarios(tx); // Resolve legacy ownership before calling the money service.
        tx.setEstado(Transaccion.EstadoTransaccion.PROCESANDO);
        tx = transaccionRepository.save(tx);
        try {
            boolean credito=tx.getTipoTransaccion()==Transaccion.TipoTransaccion.DEPOSITO
                    || tx.getTipoTransaccion()==Transaccion.TipoTransaccion.DESEMBOLSO_PRESTAMO;
            cuentaFeignClient.aplicar(new MovimientoRequest(tx.getOperacionId(),tx.getCuentaOrigenId(),tx.getCuentaDestinoId(),
                    credito ? tx.getMonto() : tx.getMonto().negate(),tx.getMoneda()));
            tx.setEstado(Transaccion.EstadoTransaccion.COMPLETADA);
            auditoriaOutbox.registrar(new AuditoriaRequest("MOVIMIENTO_COMPLETADO","TRANSACCION",tx.getId(),tx.getTipoTransaccion().name()));
            notificarMovimiento(tx);
            return construirRespuesta(transaccionRepository.save(tx));
        } catch (FeignException ex) {
            if(ex.status()>=400 && ex.status()<500) {
                tx.setEstado(Transaccion.EstadoTransaccion.FALLIDA);
                transaccionRepository.save(tx);
                antifraudeService.evaluarIntentoFallido(tx,origen);
                throw new ResponseStatusException(HttpStatus.CONFLICT,"Movimiento rechazado; no se modificaron saldos");
            }
            // An ambiguous remote result stays retryable with the SAME operation key.
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,
                    "Resultado pendiente de confirmar; reintente con la misma clave de operación");
        }
    }

    @Transactional(isolation = org.springframework.transaction.annotation.Isolation.READ_COMMITTED,
            noRollbackFor = ResponseStatusException.class)
    public TransaccionResponse revertir(Long id) {
        Transaccion original=transaccionRepository.bloquearPorId(id).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,"Transacción inexistente"));
        if(original.getTipoTransaccion()==Transaccion.TipoTransaccion.REVERSION
                || original.getTipoTransaccion()==Transaccion.TipoTransaccion.PAGO_PRESTAMO
                || original.getTipoTransaccion()==Transaccion.TipoTransaccion.DESEMBOLSO_PRESTAMO)
            throw new ResponseStatusException(HttpStatus.CONFLICT,"Este tipo de operación no admite reversión independiente");
        var previo=transaccionRepository.findByOperacionId("reversion:"+id);
        if(previo.isPresent()) return construirRespuesta(previo.get());
        if(original.getEstado()!=Transaccion.EstadoTransaccion.COMPLETADA)
            throw new ResponseStatusException(HttpStatus.CONFLICT,"Solo se pueden revertir operaciones completadas");

        asegurarDestinatarios(original);
        BigDecimal delta=original.getTipoTransaccion()==Transaccion.TipoTransaccion.DEPOSITO ? original.getMonto().negate() : original.getMonto();
        try {
            cuentaFeignClient.aplicar(new MovimientoRequest("reversion:"+id,original.getCuentaOrigenId(),original.getCuentaDestinoId(),delta,original.getMoneda()));
        } catch(FeignException ex) {
            throw new ResponseStatusException(ex.status()>=400 && ex.status()<500 ? HttpStatus.CONFLICT : HttpStatus.SERVICE_UNAVAILABLE,
                    "No se pudo confirmar la reversión; reintente la misma operación");
        }
        Transaccion reversal=Transaccion.builder().operacionId("reversion:"+id)
                .cuentaOrigenId(original.getCuentaOrigenId()).cuentaDestinoId(original.getCuentaDestinoId())
                .usuarioOrigenId(original.getUsuarioOrigenId()).usuarioDestinoId(original.getUsuarioDestinoId())
                .transaccionPadreId(id).tipoTransaccion(Transaccion.TipoTransaccion.REVERSION)
                .monto(original.getMonto()).moneda(original.getMoneda())
                .descripcion("Reversión de "+original.getNumeroReferencia()).estado(Transaccion.EstadoTransaccion.COMPLETADA).build();
        auditoriaOutbox.registrar(new AuditoriaRequest("REVERSION_TRANSACCION","TRANSACCION",id,"Reversión compensatoria"));
        original.setEstado(Transaccion.EstadoTransaccion.REVERTIDA);
        transaccionRepository.save(original);
        reversal=transaccionRepository.save(reversal);
        notificarMovimiento(reversal);
        return construirRespuesta(reversal);
    }

    private void asegurarDestinatarios(Transaccion tx){
        if(tx.getUsuarioOrigenId()==null)tx.setUsuarioOrigenId(cuentaFeignClient.obtenerCuentaPorId(tx.getCuentaOrigenId()).getUsuarioId());
        if(tx.getCuentaDestinoId()!=null && tx.getUsuarioDestinoId()==null)
            tx.setUsuarioDestinoId(cuentaFeignClient.obtenerCuentaPorId(tx.getCuentaDestinoId()).getUsuarioId());
    }

    private void notificarMovimiento(Transaccion tx){
        // Loans issue their own confirmation in the loan transaction, avoiding two notices for one payment.
        if(tx.getTipoTransaccion()==Transaccion.TipoTransaccion.PAGO_PRESTAMO || tx.getTipoTransaccion()==Transaccion.TipoTransaccion.DESEMBOLSO_PRESTAMO)return;
        String tipo=tx.getTipoTransaccion()==Transaccion.TipoTransaccion.REVERSION ? "MOVIMIENTO_REVERTIDO" : "MOVIMIENTO_CONFIRMADO";
        String titulo=switch(tx.getTipoTransaccion()){
            case TRANSFERENCIA -> tx.getUsuarioOrigenId().equals(tx.getUsuarioDestinoId()) ? "Transferencia entre tus cuentas" : "Transferencia enviada";
            case REVERSION -> "Reversión confirmada";
            case DEPOSITO -> "Depósito confirmado";
            case RETIRO -> "Retiro confirmado";
            default -> "Pago confirmado";
        };
        String mensaje=tx.getMoneda()+" "+tx.getMonto().setScale(2).toPlainString()+". Referencia "+tx.getNumeroReferencia()+". Consulta el detalle del movimiento.";
        notificaciones.registrar("tx:"+tx.getId()+":"+tx.getUsuarioOrigenId(),tx.getUsuarioOrigenId(),tipo,tx.getId(),titulo,mensaje);
        if(tx.getUsuarioDestinoId()!=null && !tx.getUsuarioDestinoId().equals(tx.getUsuarioOrigenId()))
            notificaciones.registrar("tx:"+tx.getId()+":"+tx.getUsuarioDestinoId(),tx.getUsuarioDestinoId(),tipo,tx.getId(),
                    tx.getTipoTransaccion()==Transaccion.TipoTransaccion.REVERSION ? titulo : "Transferencia recibida",mensaje);
    }

    private String huella(TransaccionRequest r) {
        String valor=r.getCuentaOrigenId()+":"+r.getNumeroCuentaOrigen()+":"+r.getNumeroCuentaDestino()+":"+r.getTipoTransaccion()+":"+r.getMonto().stripTrailingZeros().toPlainString()+":"+r.getMoneda()+":"+r.getDescripcion();
        try { return java.util.HexFormat.of().formatHex(java.security.MessageDigest.getInstance("SHA-256").digest(valor.getBytes(java.nio.charset.StandardCharsets.UTF_8))); }
        catch(java.security.NoSuchAlgorithmException ex) { throw new IllegalStateException(ex); }
    }

    private void validarOperacion(CuentaClientDTO origen, CuentaClientDTO destino, TransaccionRequest request) {
        if(request.getMoneda()!=null && !request.getMoneda().equalsIgnoreCase(origen.getMoneda()))
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"La moneda no coincide con la cuenta");
        if (!"ACTIVA".equals(origen.getEstado())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "La cuenta origen no está activa");
        }
        if (destino != null) {
            if (!"ACTIVA".equals(destino.getEstado())) {
                throw new ResponseStatusException(HttpStatus.CONFLICT, "La cuenta destino no está activa");
            }
            if (!origen.getMoneda().equals(destino.getMoneda())) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "Las cuentas deben usar la misma moneda; conversión no configurada");
            }
            if (origen.getId().equals(destino.getId())) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Las cuentas deben ser diferentes");
            }
        }
    }

    private CuentaClientDTO resolverCuenta(String numero, Long id, String tipo) {
        if ((numero == null || numero.isBlank()) && (id == null || id <= 0)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "La cuenta " + tipo + " es obligatoria");
        }
        try {
            CuentaClientDTO cuenta = numero != null && !numero.isBlank()
                    ? cuentaFeignClient.obtenerCuentaPorNumero(numero)
                    : cuentaFeignClient.obtenerCuentaPorId(id);
            if (cuenta == null) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Cuenta " + tipo + " no encontrada");
            return cuenta;
        } catch (FeignException.NotFound ex) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Cuenta " + tipo + " no encontrada");
        } catch (FeignException ex) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,
                    "No se pudo validar la cuenta " + tipo);
        }
    }

    private Long resolverCuentaFiltro(String numeroCuenta) {
        if (numeroCuenta == null || numeroCuenta.isBlank()) return null;
        try { return cuentaFeignClient.obtenerCuentaPorNumero(numeroCuenta).getId(); }
        catch (FeignException.NotFound ex) { return -1L; }
    }

    private Transaccion obtener(Long id) {
        return transaccionRepository.findById(id).orElseThrow(() ->
                new ResponseStatusException(HttpStatus.NOT_FOUND, "Transacción no encontrada con id: " + id));
    }

    private Transaccion.TipoTransaccion parseTipo(String value) {
        if (value == null || value.isBlank()) return null;
        try { return Transaccion.TipoTransaccion.valueOf(value.toUpperCase()); }
        catch (IllegalArgumentException ex) { throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Tipo inválido"); }
    }

    private Transaccion.EstadoTransaccion parseEstado(String value) {
        if (value == null || value.isBlank()) return null;
        try { return Transaccion.EstadoTransaccion.valueOf(value.toUpperCase()); }
        catch (IllegalArgumentException ex) { throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Estado inválido"); }
    }

    private TransaccionResponse construirRespuesta(Transaccion tx) {
        TransaccionResponse response = TransaccionResponse.from(tx);
        response.setNumeroCuentaOrigen(obtenerNumeroCuenta(tx.getCuentaOrigenId()));
        response.setNumeroCuentaDestino(obtenerNumeroCuenta(tx.getCuentaDestinoId()));
        return response;
    }

    private String obtenerNumeroCuenta(Long id) {
        if (id == null) return null;
        try { return cuentaFeignClient.obtenerCuentaPorId(id).getNumeroCuenta(); }
        catch (FeignException ex) { return null; }
    }
}
