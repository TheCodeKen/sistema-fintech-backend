package com.fintech.mstransacciones.service;

import com.fintech.mstransacciones.client.CuentaClientDTO;
import com.fintech.mstransacciones.client.CuentaFeignClient;
import com.fintech.mstransacciones.dto.*;
import com.fintech.mstransacciones.entity.Alerta;
import com.fintech.mstransacciones.repository.AlertaRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.*;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;
import java.time.LocalDateTime;

@Service
@RequiredArgsConstructor
public class AlertaService {
    private final AlertaRepository repository;
    private final CuentaFeignClient cuentaFeignClient;

    public Page<AlertaResponse> listar(String nivel, String estado, String tipo, Pageable pageable) {
        return repository.buscar(parseNivel(nivel), parseEstado(estado), parseTipo(tipo), pageable)
                .map(AlertaResponse::from);
    }

    public long pendientes() {
        return repository.countByEstado(Alerta.EstadoAlerta.PENDIENTE);
    }

    public AlertaResponse resolver(Long id, AlertaResolucionRequest request) {
        Alerta alerta = obtener(id);
        if (alerta.getEstado() == Alerta.EstadoAlerta.RESUELTA
                || alerta.getEstado() == Alerta.EstadoAlerta.DESCARTADA) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "La alerta ya fue cerrada");
        }
        alerta.setEstado(Alerta.EstadoAlerta.valueOf(request.getEstado()));
        alerta.setObservacionResolucion(request.getObservacion().trim());
        alerta.setFechaResolucion(LocalDateTime.now());
        return AlertaResponse.from(repository.save(alerta));
    }

    public AlertaResponse bloquearCuenta(Long id, String observacion) {
        if(observacion==null || observacion.isBlank() || observacion.length()>1000)
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Observación obligatoria de hasta 1000 caracteres");
        Alerta alerta = obtener(id);
        if (alerta.getEstado() == Alerta.EstadoAlerta.RESUELTA
                || alerta.getEstado() == Alerta.EstadoAlerta.DESCARTADA) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "La alerta ya fue cerrada");
        }
        CuentaClientDTO cuenta = cuentaFeignClient.obtenerCuentaPorNumero(alerta.getNumeroCuenta());
        cuentaFeignClient.bloquearCuenta(cuenta.getId(), "Bloqueo preventivo por alerta antifraude #" + id);
        alerta.setEstado(Alerta.EstadoAlerta.RESUELTA);
        alerta.setObservacionResolucion(observacion.trim());
        alerta.setFechaResolucion(LocalDateTime.now());
        return AlertaResponse.from(repository.save(alerta));
    }

    private Alerta obtener(Long id) {
        return repository.findById(id).orElseThrow(() ->
                new ResponseStatusException(HttpStatus.NOT_FOUND, "Alerta no encontrada"));
    }
    private Alerta.NivelRiesgo parseNivel(String value) {
        return value == null || value.isBlank() ? null : parse(value, Alerta.NivelRiesgo.class, "nivel de riesgo");
    }
    private Alerta.EstadoAlerta parseEstado(String value) {
        return value == null || value.isBlank() ? null : parse(value, Alerta.EstadoAlerta.class, "estado");
    }
    private Alerta.TipoAlerta parseTipo(String value) {
        return value == null || value.isBlank() ? null : parse(value, Alerta.TipoAlerta.class, "tipo");
    }
    private <T extends Enum<T>> T parse(String value, Class<T> type, String field) {
        try { return Enum.valueOf(type, value.toUpperCase()); }
        catch (IllegalArgumentException ex) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Valor inválido para " + field);
        }
    }
}
