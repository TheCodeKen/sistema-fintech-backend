package com.fintech.mstransacciones.service;

import com.fintech.mstransacciones.client.CuentaClientDTO;
import com.fintech.mstransacciones.entity.*;
import com.fintech.mstransacciones.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import java.math.BigDecimal;
import java.time.*;

@Service
@RequiredArgsConstructor
@Slf4j
public class AntifraudeService {
    private final AlertaRepository alertaRepository;
    private final TransaccionRepository transaccionRepository;
    @Value("${antifraude.umbral-pen:10000}")
    private BigDecimal umbralPen;
    @Value("${antifraude.umbral-usd:3000}")
    private BigDecimal umbralUsd;
    @Value("${antifraude.umbral-cuenta-nueva:5000}")
    private BigDecimal umbralCuentaNueva;
    @Value("${antifraude.intentos-fallidos:3}")
    private int intentosFallidos;

    public void evaluar(Transaccion tx, CuentaClientDTO origen, CuentaClientDTO destino) {
        if (esMontoElevado(tx)) {
            registrar(Alerta.TipoAlerta.MONTO_ELEVADO, Alerta.NivelRiesgo.ALTO, origen, tx,
                    "Monto de " + tx.getMonto() + " " + tx.getMoneda() + " supera el umbral configurado");
        }

        if (tx.getTipoTransaccion() == Transaccion.TipoTransaccion.TRANSFERENCIA
                && destino != null
                && transaccionRepository.countRepetitivas(origen.getId(), destino.getId(),
                tx.getTipoTransaccion(), LocalDateTime.now().minusMinutes(5)) >= 3) {
            registrar(Alerta.TipoAlerta.TRANSACCION_REPETITIVA, Alerta.NivelRiesgo.MEDIO, origen, tx,
                    "Más de 3 transferencias hacia el mismo destino durante los últimos 5 minutos");
        }
        if (esCuentaNueva(origen) && tx.getMonto().compareTo(umbralCuentaNueva) >= 0) {
            registrar(Alerta.TipoAlerta.CUENTA_NUEVA_CON_ALTO_MOVIMIENTO, Alerta.NivelRiesgo.ALTO,
                    origen, tx, "Cuenta pendiente o abierta hace menos de 24 horas con movimiento significativo");
        }
    }
    public void evaluarIntentoFallido(Transaccion tx, CuentaClientDTO origen) {
        long intentos = transaccionRepository.countPorEstadoDesde(origen.getId(),
                Transaccion.EstadoTransaccion.FALLIDA, LocalDateTime.now().minusMinutes(15));
        if (intentos >= intentosFallidos) {
            registrar(Alerta.TipoAlerta.INTENTOS_FALLIDOS, Alerta.NivelRiesgo.CRITICO, origen, tx,
                    "Se detectaron " + intentos + " intentos fallidos en los últimos 15 minutos");
        }
    }

    private boolean esMontoElevado(Transaccion tx) {
        return (tx.getTipoTransaccion() == Transaccion.TipoTransaccion.TRANSFERENCIA
                || tx.getTipoTransaccion() == Transaccion.TipoTransaccion.RETIRO)
                && tx.getMonto().compareTo("USD".equalsIgnoreCase(tx.getMoneda()) ? umbralUsd : umbralPen) > 0;
    }

    private boolean esCuentaNueva(CuentaClientDTO cuenta) {
        return "PENDIENTE_VERIFICACION".equals(cuenta.getEstado())
                || (cuenta.getFechaApertura() != null
                && cuenta.getFechaApertura().isAfter(LocalDateTime.now().minusHours(24)));
    }

    private void registrar(Alerta.TipoAlerta tipo, Alerta.NivelRiesgo nivel, CuentaClientDTO cuenta,
                           Transaccion tx, String descripcion) {
        alertaRepository.save(Alerta.builder().tipoAlerta(tipo).nivelRiesgo(nivel)
                .estado(Alerta.EstadoAlerta.PENDIENTE).numeroCuenta(cuenta.getNumeroCuenta())
                .transaccionId(tx.getId()).descripcion(descripcion).build());
    }
}
