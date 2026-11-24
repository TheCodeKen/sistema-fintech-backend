package com.fintech.msprestamos.service;

import com.fintech.msprestamos.client.CuentaFeignClient;
import com.fintech.msprestamos.client.TransaccionFeignClient;
import com.fintech.msprestamos.client.AuditoriaFeignClient;
import com.fintech.msprestamos.client.UsuarioFeignClient;
import com.fintech.msprestamos.dto.*;
import com.fintech.msprestamos.entity.Prestamo;
import com.fintech.msprestamos.repository.PrestamoRepository;
import feign.FeignException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import com.fintech.msprestamos.config.security.Acceso;
import java.math.MathContext;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.function.Supplier;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class PrestamoService {
    private final PrestamoRepository prestamoRepository;
    private final CronogramaService cronograma;
    private final java.time.Clock reloj;
    private final com.fintech.msprestamos.repository.PagoRepository pagoRepository;
    private final UsuarioFeignClient usuarioFeignClient;
    private final CuentaFeignClient cuentaFeignClient;
    private final TransaccionFeignClient transaccionFeignClient;
    private final AuditoriaOutbox auditoriaOutbox;
    private final NotificacionOutbox notificaciones;

    public List<PrestamoResponse> listarTodos() {
        return prestamoRepository.findAll().stream().map(PrestamoResponse::from).collect(Collectors.toList());
    }

    public Page<PrestamoResponse> listarTodos(String estado, Long usuarioId, BigDecimal minimo,
                                               BigDecimal maximo, Pageable pageable) {
        Prestamo.EstadoPrestamo estadoEnum = parseEstado(estado);
        BigDecimal desde = minimo == null ? BigDecimal.ZERO : minimo;
        BigDecimal hasta = maximo == null ? new BigDecimal("999999999999.99") : maximo;
        Page<Prestamo> page;
        if (estadoEnum != null && usuarioId != null) {
            page = prestamoRepository.findByEstadoAndUsuarioIdAndMontoSolicitadoBetween(estadoEnum, usuarioId, desde, hasta, pageable);
        } else if (estadoEnum != null) {
            page = prestamoRepository.findByEstadoAndMontoSolicitadoBetween(estadoEnum, desde, hasta, pageable);
        } else if (usuarioId != null) {
            page = prestamoRepository.findByUsuarioIdAndMontoSolicitadoBetween(usuarioId, desde, hasta, pageable);
        } else {
            page = prestamoRepository.findByMontoSolicitadoBetween(desde, hasta, pageable);
        }
        return page.map(PrestamoResponse::from);
    }

    public List<PrestamoResponse> listarPorUsuario(Long usuarioId) {
        Acceso.propietario(usuarioId);
        return prestamoRepository.findByUsuarioId(usuarioId).stream()
                .map(PrestamoResponse::from).collect(Collectors.toList());
    }

    public PrestamoResponse buscarPorId(Long id) {
        Prestamo p = obtener(id);
        Acceso.propietario(p.getUsuarioId());
        return PrestamoResponse.from(p);
    }

    @Transactional
    public PrestamoResponse crear(PrestamoRequest request) {
        Acceso.propietario(request.getUsuarioId());
        UsuarioClientDTO usuario = llamar(() -> usuarioFeignClient.obtenerUsuarioPorId(request.getUsuarioId()),
                "ms-usuarios no disponible");
        if (!Boolean.TRUE.equals(usuario.getActivo())) {
            throw error(HttpStatus.BAD_REQUEST, "El usuario está inactivo y no puede solicitar préstamos");
        }
        CuentaClientDTO cuenta = llamar(() -> cuentaFeignClient.obtenerCuentaPorId(request.getCuentaDesembolsoId()),
                "ms-cuentas no disponible");
        validarCuentaDelUsuario(cuenta, request.getUsuarioId());
        String moneda = request.getMoneda() == null ? cuenta.getMoneda() : request.getMoneda().trim().toUpperCase();
        if (!("PEN".equals(moneda) || "USD".equals(moneda)) || !moneda.equals(cuenta.getMoneda()))
            throw error(HttpStatus.BAD_REQUEST, "La moneda debe coincidir con la cuenta");
        if (!Acceso.admin() && request.getTasaInteres().compareTo(new BigDecimal("18.00")) != 0)
            throw error(HttpStatus.BAD_REQUEST, "La tasa vigente es 18% anual");
        BigDecimal cuota = calcularCuotaMensual(request.getMontoSolicitado(), request.getTasaInteres(), request.getPlazoMeses());
        if (cuota.multiply(BigDecimal.valueOf(request.getPlazoMeses())).compareTo(new BigDecimal("9999999999999.99")) > 0)
            throw error(HttpStatus.BAD_REQUEST, "El total del préstamo supera el máximo permitido. Reduce el importe o el plazo.");
        Prestamo prestamo = Prestamo.builder()
                .usuarioId(request.getUsuarioId())
                .nombreUsuario(usuario.getNombre() + " " + usuario.getApellido())
                .cuentaDesembolsoId(cuenta.getId())
                .numeroCuenta(cuenta.getNumeroCuenta())
                .montoSolicitado(request.getMontoSolicitado())
                .montoAprobado(request.getMontoSolicitado())
                .saldoPendiente(cuota.multiply(BigDecimal.valueOf(request.getPlazoMeses())))
                .tasaInteres(request.getTasaInteres())
                .plazoMeses(request.getPlazoMeses())
                .cuotaMensual(cuota)
                .tipoPrestamo(request.getTipoPrestamo())
                .estado(Prestamo.EstadoPrestamo.PENDIENTE)
                .moneda(moneda)
                .fechaVencimiento(null)
                .build();
        prestamo=prestamoRepository.save(prestamo);
        notificarEstado(prestamo,"SOLICITADO","Solicitud recibida");
        return PrestamoResponse.from(prestamo);
    }

    @Transactional
    public PrestamoResponse revisar(Long id) {
        Prestamo p = bloquear(id);
        exigirEstado(p, Prestamo.EstadoPrestamo.PENDIENTE);
        p.setEstado(Prestamo.EstadoPrestamo.EN_REVISION);
        PrestamoResponse response = guardar(p);
        auditar("REVISION_PRESTAMO", id, "Estado nuevo: EN_REVISION");
        notificarEstado(p,"EN_REVISION","Tu solicitud está en revisión");
        return response;
    }

    @Transactional
    public PrestamoResponse aprobar(Long id, String observacion) {
        Prestamo p = bloquear(id);
        exigirEstado(p, Prestamo.EstadoPrestamo.EN_REVISION);
        p.setEstado(Prestamo.EstadoPrestamo.APROBADO);
        p.setObservacion(observacion);
        p.setFechaAprobacion(LocalDateTime.now());
        PrestamoResponse response = guardar(p);
        auditar("APROBACION_PRESTAMO", id, "Estado nuevo: APROBADO; observación: " + observacion);
        notificarEstado(p,"APROBADO","Préstamo aprobado");
        return response;
    }

    @Transactional
    public PrestamoResponse rechazar(Long id, String motivo) {
        if (motivo == null || motivo.isBlank()) throw error(HttpStatus.BAD_REQUEST, "El motivo de rechazo es obligatorio");
        Prestamo p = bloquear(id);
        exigirEstado(p, Prestamo.EstadoPrestamo.EN_REVISION);
        p.setEstado(Prestamo.EstadoPrestamo.RECHAZADO);
        p.setMotivoRechazo(motivo.trim());
        PrestamoResponse response = guardar(p);
        auditar("RECHAZO_PRESTAMO", id, "Estado nuevo: RECHAZADO; motivo: " + motivo.trim());
        notificarEstado(p,"RECHAZADO","Solicitud no aprobada");
        return response;
    }

    @Transactional
    public PrestamoResponse desembolsar(Long id) {
        Prestamo p = bloquear(id);
        if(p.getEstado()==Prestamo.EstadoPrestamo.DESEMBOLSADO || p.getEstado()==Prestamo.EstadoPrestamo.VENCIDO || p.getEstado()==Prestamo.EstadoPrestamo.PAGADO) return PrestamoResponse.from(p);
        exigirEstado(p, Prestamo.EstadoPrestamo.APROBADO);
        CuentaClientDTO cuenta = obtenerCuentaActiva(p.getCuentaDesembolsoId(), p.getUsuarioId());
        BigDecimal monto = p.getMontoAprobado() == null ? p.getMontoSolicitado() : p.getMontoAprobado();
        try {
            registrarTransaccion(cuenta.getId(), "DESEMBOLSO_PRESTAMO", monto, p.getMoneda(),
                    "Desembolso del préstamo " + p.getNumeroPrestamo(), "prestamo:"+id+":desembolso");
            p.setEstado(Prestamo.EstadoPrestamo.DESEMBOLSADO);
            p.setFechaDesembolso(LocalDate.now(reloj));
            p.setFechaVencimiento(p.getFechaDesembolso().plusMonths(p.getPlazoMeses()));
            cronograma.preparar(p);
            PrestamoResponse response = guardar(p);
            auditar("DESEMBOLSO_PRESTAMO", id, "Estado nuevo: DESEMBOLSADO; monto: " + monto);
            notificarEstado(p,"DESEMBOLSADO","Desembolso confirmado");
            return response;
        } catch (FeignException ex) {
            throw error(HttpStatus.BAD_GATEWAY, "No se pudo completar el desembolso");
        }
    }

    @Transactional
    public PrestamoResponse pagar(Long id, PagoPrestamoDTO request) {
        Prestamo p = bloquear(id);
        Acceso.propietario(p.getUsuarioId());
        String clave="prestamo:"+id+":pago:"+request.getOperacionId();
        String huella=request.getCuentaId()+":"+request.getMonto().stripTrailingZeros().toPlainString();
        var previo=pagoRepository.findById(clave);
        if(previo.isPresent()) {
            if(!huella.equals(previo.get().getHuella())) throw error(HttpStatus.CONFLICT,"La clave ya tiene otro pago");
            return PrestamoResponse.from(p);
        }
        if(p.getEstado()!=Prestamo.EstadoPrestamo.DESEMBOLSADO && p.getEstado()!=Prestamo.EstadoPrestamo.VENCIDO)
            throw error(HttpStatus.CONFLICT,"Solo se pueden pagar préstamos desembolsados o vencidos");
        var plan=cronograma.preparar(p);
        cronograma.validarSaldo(p,plan);
        if (request.getMonto().compareTo(p.getSaldoPendiente()) > 0) {
            throw error(HttpStatus.BAD_REQUEST, "El pago no puede superar el saldo pendiente");
        }
        CuentaClientDTO cuenta = obtenerCuentaActiva(request.getCuentaId(), p.getUsuarioId());
        if (!p.getMoneda().equalsIgnoreCase(cuenta.getMoneda())) {
            throw error(HttpStatus.BAD_REQUEST, "La moneda de la cuenta no coincide con la del préstamo");
        }
        try {
            Long transaccionId=registrarTransaccion(cuenta.getId(), "PAGO_PRESTAMO", request.getMonto(), p.getMoneda(),
                    "Pago del préstamo " + p.getNumeroPrestamo(), clave);
            var pago=new com.fintech.msprestamos.entity.PagoAplicado(clave,huella);
            pago.setPrestamoId(id);pago.setCuentaId(cuenta.getId());pago.setMonto(request.getMonto());
            pago.setFechaPago(LocalDateTime.now(reloj));pago.setTransaccionId(transaccionId);
            pagoRepository.save(pago);
            cronograma.aplicar(plan,request.getMonto());
            p.setSaldoPendiente(p.getSaldoPendiente().subtract(request.getMonto()).setScale(2, RoundingMode.HALF_UP));
            p.setEstado(cronograma.estado(p,plan));
            auditar("PAGO_PRESTAMO",id,"Pago confirmado; operación: "+clave);
            notificaciones.registrar(clave,p.getUsuarioId(),"PRESTAMO_PAGO",id,"Pago de préstamo confirmado",
                    "Se aplicaron "+p.getMoneda()+" "+request.getMonto().setScale(2).toPlainString()+" al préstamo "+p.getNumeroPrestamo()+".");
            if(p.getEstado()==Prestamo.EstadoPrestamo.PAGADO)notificarEstado(p,"PAGADO","Préstamo pagado por completo");
            return guardar(p);
        } catch (FeignException ex) {
            throw error(HttpStatus.BAD_GATEWAY, "No se pudo registrar el pago");
        }
    }

    @Transactional
    public PrestamoDetalleResponse detalle(Long id) {
        Prestamo p=bloquear(id);
        Acceso.propietario(p.getUsuarioId());
        var plan=cronograma.preparar(p);
        actualizarEstado(p,plan);
        return cronograma.detalle(p,plan);
    }

    @Transactional
    public PrestamoResponse cancelar(Long id,String motivo) {
        Prestamo p=bloquear(id);
        Acceso.propietario(p.getUsuarioId());
        if(p.getEstado()==Prestamo.EstadoPrestamo.CANCELADO) return PrestamoResponse.from(p);
        boolean permitida=p.getEstado()==Prestamo.EstadoPrestamo.PENDIENTE
                || p.getEstado()==Prestamo.EstadoPrestamo.EN_REVISION
                || (Acceso.admin() && p.getEstado()==Prestamo.EstadoPrestamo.APROBADO);
        if(!permitida) throw error(HttpStatus.CONFLICT,"La solicitud ya no admite cancelación");
        if(motivo==null || motivo.trim().length()<5 || motivo.trim().length()>500)
            throw error(HttpStatus.BAD_REQUEST,"Indique un motivo de 5 a 500 caracteres");
        p.setEstado(Prestamo.EstadoPrestamo.CANCELADO);
        p.setMotivoCancelacion(motivo.trim());p.setFechaCancelacion(LocalDateTime.now(reloj));
        auditar("CANCELACION_PRESTAMO",id,"Solicitud cancelada; motivo: "+motivo.trim());
        notificarEstado(p,"CANCELADO","Solicitud cancelada");
        return guardar(p);
    }

    @Transactional
    public void actualizarVencimiento(Long id) {
        Prestamo p=bloquear(id);
        if(p.getEstado()!=Prestamo.EstadoPrestamo.DESEMBOLSADO && p.getEstado()!=Prestamo.EstadoPrestamo.VENCIDO) return;
        actualizarEstado(p,cronograma.preparar(p));
    }

    private void actualizarEstado(Prestamo p,java.util.List<com.fintech.msprestamos.entity.CuotaPrestamo> plan) {
        var estado=cronograma.estado(p,plan);
        if(estado!=p.getEstado()) {
            p.setEstado(estado);prestamoRepository.save(p);
            auditar(estado==Prestamo.EstadoPrestamo.VENCIDO ? "VENCIMIENTO_PRESTAMO" : "REGULARIZACION_PRESTAMO",
                    p.getId(),"Estado actualizado: "+estado);
        }
        notificarCuotas(p,plan);
    }

    private void notificarEstado(Prestamo p,String tipo,String titulo){
        notificaciones.registrar("prestamo:"+p.getId()+":"+tipo,p.getUsuarioId(),"PRESTAMO_"+tipo,p.getId(),titulo,
                "Préstamo "+p.getNumeroPrestamo()+". Consulta el detalle para revisar la solicitud, el cronograma y los pagos.");
    }

    private void notificarCuotas(Prestamo p,List<com.fintech.msprestamos.entity.CuotaPrestamo> plan){
        if(p.getEstado()!=Prestamo.EstadoPrestamo.DESEMBOLSADO && p.getEstado()!=Prestamo.EstadoPrestamo.VENCIDO)return;
        LocalDate hoy=LocalDate.now(reloj);
        for(var c:plan){
            if(c.pendiente().signum()<=0 || c.getVencimiento().isAfter(hoy.plusDays(3)))continue;
            boolean vencida=c.getVencimiento().isBefore(hoy);
            String tipo=vencida ? "CUOTA_VENCIDA" : "CUOTA_PROXIMA";
            String titulo=vencida ? "Tienes una cuota vencida" : c.getVencimiento().equals(hoy) ? "Tu cuota vence hoy" : "Tu cuota está por vencer";
            notificaciones.registrar("prestamo:"+p.getId()+":cuota:"+c.getNumero()+":"+tipo,p.getUsuarioId(),tipo,p.getId(),titulo,
                    "Cuota "+c.getNumero()+" del préstamo "+p.getNumeroPrestamo()+". Vencimiento "+c.getVencimiento().format(java.time.format.DateTimeFormatter.ofPattern("dd/MM/yyyy"))
                    +". Pendiente "+p.getMoneda()+" "+c.pendiente().setScale(2).toPlainString()+".");
        }
    }

    private Long registrarTransaccion(Long cuentaId, String tipo, BigDecimal monto, String moneda, String descripcion, String clave) {
        var resultado=transaccionFeignClient.crear(new TransaccionClientRequest(cuentaId, null, tipo, monto, moneda, descripcion),clave);
        if(resultado==null || !"COMPLETADA".equals(resultado.estado()))
            throw error(HttpStatus.CONFLICT,"El movimiento financiero no se completó");
        return resultado.id();
    }

    private void auditar(String accion, Long id, String detalles) {
        auditoriaOutbox.registrar(new AuditoriaRequest(accion, "PRESTAMO", id, detalles));
    }

    private CuentaClientDTO obtenerCuentaActiva(Long cuentaId, Long usuarioId) {
        CuentaClientDTO cuenta = llamar(() -> cuentaFeignClient.obtenerCuentaPorId(cuentaId), "ms-cuentas no disponible");
        validarCuentaDelUsuario(cuenta, usuarioId);
        if (!"ACTIVA".equals(cuenta.getEstado())) throw error(HttpStatus.BAD_REQUEST, "La cuenta no está activa");
        return cuenta;
    }

    private void validarCuentaDelUsuario(CuentaClientDTO cuenta, Long usuarioId) {
        if (cuenta.getUsuarioId() == null || !cuenta.getUsuarioId().equals(usuarioId)) {
            throw error(HttpStatus.BAD_REQUEST, "La cuenta no pertenece al usuario");
        }
        if (!"ACTIVA".equals(cuenta.getEstado())) throw error(HttpStatus.BAD_REQUEST, "La cuenta no está activa");
    }

    private <T> T llamar(Supplier<T> call, String unavailableMessage) {
        try {
            return call.get();
        } catch (FeignException.NotFound ex) {
            throw error(HttpStatus.NOT_FOUND, "Recurso no encontrado");
        } catch (FeignException ex) {
            throw error(HttpStatus.SERVICE_UNAVAILABLE, unavailableMessage);
        }
    }

    private Prestamo bloquear(Long id) {
        return prestamoRepository.bloquearPorId(id).orElseThrow(() -> error(HttpStatus.NOT_FOUND,"Préstamo no encontrado"));
    }
    private Prestamo obtener(Long id) {
        return prestamoRepository.findById(id)
                .orElseThrow(() -> error(HttpStatus.NOT_FOUND, "Préstamo no encontrado con id: " + id));
    }

    private void exigirEstado(Prestamo p, Prestamo.EstadoPrestamo esperado) {
        if (p.getEstado() != esperado) throw error(HttpStatus.CONFLICT,
                "La operación requiere estado " + esperado + "; estado actual: " + p.getEstado());
    }

    private PrestamoResponse guardar(Prestamo p) {
        return PrestamoResponse.from(prestamoRepository.save(p));
    }

    private ResponseStatusException error(HttpStatus status, String message) {
        return new ResponseStatusException(status, message);
    }

    private Prestamo.EstadoPrestamo parseEstado(String value) {
        if (value == null || value.isBlank()) return null;
        try { return Prestamo.EstadoPrestamo.valueOf(value.toUpperCase()); }
        catch (IllegalArgumentException ex) { throw error(HttpStatus.BAD_REQUEST, "Estado de préstamo inválido"); }
    }

    private BigDecimal calcularCuotaMensual(BigDecimal monto, BigDecimal tasaAnual, int plazoMeses) {
        BigDecimal tasaMensual = tasaAnual.divide(BigDecimal.valueOf(12), 10, RoundingMode.HALF_UP)
                .divide(BigDecimal.valueOf(100), 10, RoundingMode.HALF_UP);
        if (tasaMensual.signum() == 0) return monto.divide(BigDecimal.valueOf(plazoMeses), 2, RoundingMode.HALF_UP);
        BigDecimal factor = BigDecimal.ONE.add(tasaMensual).pow(plazoMeses, new MathContext(10));
        return monto.multiply(tasaMensual).multiply(factor)
                .divide(factor.subtract(BigDecimal.ONE), 2, RoundingMode.HALF_UP);
    }
}
