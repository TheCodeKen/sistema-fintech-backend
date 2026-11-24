package com.fintech.mscuentas.service;

import com.fintech.mscuentas.dto.CuentaResponse;
import com.fintech.mscuentas.entity.Cuenta;
import com.fintech.mscuentas.repository.CuentaRepository;
import com.fintech.mscuentas.client.AuditoriaFeignClient;
import com.fintech.mscuentas.dto.AuditoriaRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;
import java.math.BigDecimal;
import com.fintech.mscuentas.config.security.Acceso;
import java.util.List;
import java.util.stream.Collectors;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import com.fintech.mscuentas.client.UsuarioFeignClient;
import com.fintech.mscuentas.dto.CrearCuentaDTO;

@Service
@RequiredArgsConstructor
@Slf4j
public class CuentaService {

    private final CuentaRepository cuentaRepository;
    private final AuditoriaOutbox auditoriaOutbox;
    private final UsuarioFeignClient usuarioFeignClient;
    private final com.fintech.mscuentas.client.PrestamoFeignClient prestamoFeignClient;

    public Page<CuentaResponse> listarTodas(String moneda, String estado, String numeroCuenta, Pageable pageable) {
        Cuenta.EstadoCuenta estadoEnum = parseEstado(estado);
        return cuentaRepository.buscar(normalize(moneda), estadoEnum, normalize(numeroCuenta), pageable)
                .map(CuentaResponse::from);
    }

    public List<CuentaResponse> listarPorUsuario(Long usuarioId) {
        Acceso.lectura(usuarioId);
        return cuentaRepository.findByUsuarioId(usuarioId)
                .stream().map(CuentaResponse::from).collect(Collectors.toList());
    }

    public CuentaResponse buscarPorId(Long id) {
        Cuenta cuenta = cuentaRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                        "Cuenta no encontrada con id: " + id));
        Acceso.lectura(cuenta.getUsuarioId());
        return CuentaResponse.from(cuenta);
    }

    public CuentaResponse buscarPorNumero(String numeroCuenta) {
        Cuenta cuenta = cuentaRepository.findByNumeroCuenta(numeroCuenta)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                        "Cuenta no encontrada con número: " + numeroCuenta));
        Acceso.lectura(cuenta.getUsuarioId());
        return CuentaResponse.from(cuenta);
    }

    public CuentaResponse crear(CrearCuentaDTO request) {
        Acceso.propietario(request.getUsuarioId());
        if (!Acceso.admin() && request.getSaldoInicial() != null && request.getSaldoInicial().signum() != 0)
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Las cuentas de clientes se abren con saldo cero");
        validarUsuario(request.getUsuarioId());
        String numeroCuenta = generarNumeroCuenta();

        Cuenta cuenta = Cuenta.builder()
                .numeroCuenta(numeroCuenta)
                .usuarioId(request.getUsuarioId())
                .tipoCuenta(parseTipoCuenta(request.getTipoCuenta()))
                .saldo(request.getSaldoInicial() != null ? request.getSaldoInicial() : BigDecimal.ZERO)
                .moneda(normalizeCurrency(request.getMoneda()))
                .estado(Cuenta.EstadoCuenta.PENDIENTE_VERIFICACION)
                .build();

        return CuentaResponse.from(cuentaRepository.save(cuenta));
    }

    private void validarUsuario(Long usuarioId) {
        try {
            var usuario = usuarioFeignClient.buscarPorId(usuarioId);
            if (usuario == null || !Boolean.TRUE.equals(usuario.getActivo())) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "El usuario no existe o está inactivo");
            }
        } catch (feign.FeignException.NotFound ex) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND,
                    "Usuario no encontrado con id: " + usuarioId);
        } catch (feign.FeignException ex) {
            log.error("No se pudo validar el usuario {} en ms-usuarios", usuarioId, ex);
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,
                    "No se pudo validar el usuario en este momento");
        }
    }

    private Cuenta.TipoCuenta parseTipoCuenta(String tipo) {
        if (tipo == null) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "El tipo de cuenta es obligatorio");
        String normalized = tipo.trim().toUpperCase();
        if ("AHORRO".equals(normalized)) normalized = "AHORROS";
        try {
            return Cuenta.TipoCuenta.valueOf(normalized);
        } catch (IllegalArgumentException ex) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Tipo de cuenta inválido: " + tipo);
        }
    }

    private String normalizeCurrency(String moneda) {
        String value = normalize(moneda);
        if (!"PEN".equals(value) && !"USD".equals(value)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Moneda inválida: " + moneda);
        }
        return value;
    }

    private Cuenta.EstadoCuenta parseEstado(String estado) {
        if (estado == null || estado.isBlank()) return null;
        try {
            return Cuenta.EstadoCuenta.valueOf(estado.trim().toUpperCase());
        } catch (IllegalArgumentException ex) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Estado inválido: " + estado);
        }
    }

    private String normalize(String value) {
        return value == null || value.isBlank() ? null : value.trim().toUpperCase();
    }

    @org.springframework.transaction.annotation.Transactional
    public CuentaResponse activar(Long id) {
        Cuenta cuenta = obtenerCuenta(id);
        if (cuenta.getEstado() == Cuenta.EstadoCuenta.ACTIVA) return CuentaResponse.from(cuenta);
        Cuenta.EstadoCuenta anterior = cuenta.getEstado();
        validarTransicion(cuenta, Cuenta.EstadoCuenta.ACTIVA);
        cuenta.setEstado(Cuenta.EstadoCuenta.ACTIVA);
        CuentaResponse response = guardar(cuenta);
        auditar("ACTIVACION_CUENTA", id, "Estado anterior: " + anterior + "; nuevo: " + cuenta.getEstado());
        return response;
    }

    @org.springframework.transaction.annotation.Transactional
    public CuentaResponse bloquear(Long id, String motivo) {
        validarMotivo(motivo);
        Cuenta cuenta = obtenerCuenta(id);
        if (cuenta.getEstado() == Cuenta.EstadoCuenta.BLOQUEADA) return CuentaResponse.from(cuenta);
        Cuenta.EstadoCuenta anterior = cuenta.getEstado();
        validarTransicion(cuenta, Cuenta.EstadoCuenta.BLOQUEADA);
        cuenta.setEstado(Cuenta.EstadoCuenta.BLOQUEADA);
        CuentaResponse response = guardar(cuenta);
        auditar("BLOQUEO_CUENTA", id, "Estado anterior: " + anterior + "; nuevo: " + cuenta.getEstado() + "; motivo: " + motivo);
        return response;
    }

    @org.springframework.transaction.annotation.Transactional
    public CuentaResponse congelar(Long id, String motivo) {
        validarMotivo(motivo);
        Cuenta cuenta = obtenerCuenta(id);
        if (cuenta.getEstado() == Cuenta.EstadoCuenta.CONGELADA) return CuentaResponse.from(cuenta);
        Cuenta.EstadoCuenta anterior = cuenta.getEstado();
        validarTransicion(cuenta, Cuenta.EstadoCuenta.CONGELADA);
        cuenta.setEstado(Cuenta.EstadoCuenta.CONGELADA);
        CuentaResponse response = guardar(cuenta);
        auditar("CONGELAMIENTO_CUENTA", id, "Estado anterior: " + anterior + "; nuevo: " + cuenta.getEstado() + "; motivo: " + motivo);
        return response;
    }

    @org.springframework.transaction.annotation.Transactional
    public CuentaResponse desbloquear(Long id) {
        Cuenta cuenta = obtenerCuenta(id);
        if (cuenta.getEstado() == Cuenta.EstadoCuenta.ACTIVA) return CuentaResponse.from(cuenta);
        Cuenta.EstadoCuenta anterior = cuenta.getEstado();
        if (cuenta.getEstado() != Cuenta.EstadoCuenta.BLOQUEADA
                && cuenta.getEstado() != Cuenta.EstadoCuenta.CONGELADA) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Solo se pueden desbloquear cuentas bloqueadas o congeladas");
        }
        cuenta.setEstado(Cuenta.EstadoCuenta.ACTIVA);
        CuentaResponse response = guardar(cuenta);
        auditar("DESBLOQUEO_CUENTA", id, "Estado anterior: " + anterior + "; nuevo: " + cuenta.getEstado());
        return response;
    }

    @org.springframework.transaction.annotation.Transactional
    public CuentaResponse cerrar(Long id) {
        Cuenta cuenta = obtenerCuenta(id);
        if (cuenta.getEstado() == Cuenta.EstadoCuenta.CERRADA) return CuentaResponse.from(cuenta);
        if (prestamoFeignClient.obligaciones(id) > 0) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "La cuenta tiene préstamos u obligaciones pendientes");
        }
        Cuenta.EstadoCuenta anterior = cuenta.getEstado();
        validarTransicion(cuenta, Cuenta.EstadoCuenta.CERRADA);
        if (cuenta.getSaldo().compareTo(BigDecimal.ZERO) != 0) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "La cuenta debe tener saldo 0.00 para poder cerrarse");
        }
        cuenta.setEstado(Cuenta.EstadoCuenta.CERRADA);
        CuentaResponse response = guardar(cuenta);
        auditar("CIERRE_CUENTA", id, "Estado anterior: " + anterior + "; nuevo: " + cuenta.getEstado());
        return response;
    }

    @org.springframework.transaction.annotation.Transactional
    public void eliminar(Long id) {
        cerrar(id); // Baja lógica: conserva saldo e historial.

    }

    /**
     * Ajusta el saldo de una cuenta sumando el delta (puede ser negativo para descontar).
     * Usado internamente por ms-transacciones vía FeignClient.
     */
    @org.springframework.transaction.annotation.Transactional
    public CuentaResponse actualizarSaldo(Long id, java.math.BigDecimal delta) {
        Cuenta cuenta = obtenerCuenta(id);
        if (cuenta.getEstado() == Cuenta.EstadoCuenta.CERRADA
                || cuenta.getEstado() == Cuenta.EstadoCuenta.INACTIVA) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "La cuenta no admite movimientos en estado " + cuenta.getEstado());
        }
        if (delta == null || delta.compareTo(BigDecimal.ZERO) == 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "El delta debe ser distinto de cero");
        }
        if (delta.compareTo(BigDecimal.ZERO) < 0
                && (cuenta.getEstado() == Cuenta.EstadoCuenta.BLOQUEADA
                || cuenta.getEstado() == Cuenta.EstadoCuenta.CONGELADA
                || cuenta.getEstado() == Cuenta.EstadoCuenta.PENDIENTE_VERIFICACION)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "La cuenta no puede procesar débitos en estado " + cuenta.getEstado());
        }
        BigDecimal nuevoSaldo = cuenta.getSaldo().add(delta);
        if (nuevoSaldo.compareTo(BigDecimal.ZERO) < 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Saldo insuficiente. Saldo actual: " + cuenta.getSaldo());
        }
        cuenta.setSaldo(nuevoSaldo);
        return CuentaResponse.from(cuentaRepository.save(cuenta));
    }

    private Cuenta obtenerCuenta(Long id) {
        return cuentaRepository.bloquearPorId(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                        "Cuenta no encontrada con id: " + id));
    }

    private CuentaResponse guardar(Cuenta cuenta) {
        return CuentaResponse.from(cuentaRepository.save(cuenta));
    }

    private void validarMotivo(String motivo) {
        if (motivo == null || motivo.isBlank() || motivo.trim().length() < 5 || motivo.trim().length() > 500) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Debe indicar un motivo de 5 a 500 caracteres");
        }
    }

        private void auditar(String accion, Long id, String detalles) {
            auditoriaOutbox.registrar(new AuditoriaRequest(accion, "CUENTA", id, detalles));
        }


    private void validarTransicion(Cuenta cuenta, Cuenta.EstadoCuenta destino) {
        Cuenta.EstadoCuenta origen = cuenta.getEstado();
        if (origen == Cuenta.EstadoCuenta.CERRADA) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Una cuenta cerrada no puede cambiar de estado");
        }
        boolean permitida = switch (destino) {
            case ACTIVA -> origen == Cuenta.EstadoCuenta.PENDIENTE_VERIFICACION
                    || origen == Cuenta.EstadoCuenta.INACTIVA;
            case BLOQUEADA, CONGELADA -> origen == Cuenta.EstadoCuenta.ACTIVA
                    || origen == Cuenta.EstadoCuenta.INACTIVA;
            case CERRADA -> origen != Cuenta.EstadoCuenta.CERRADA;
            default -> false;
        };
        if (!permitida) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Transición no permitida: " + origen + " -> " + destino);
        }
    }

    private String generarNumeroCuenta() {
        String numero;
        do {
            numero = "FT" + String.format("%08d", new java.security.SecureRandom().nextInt(100000000));
        } while (cuentaRepository.existsByNumeroCuenta(numero));
        return numero;
    }
}
