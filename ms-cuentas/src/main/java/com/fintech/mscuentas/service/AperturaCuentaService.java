package com.fintech.mscuentas.service;

import com.fintech.mscuentas.dto.CrearCuentaDTO;
import com.fintech.mscuentas.dto.CuentaResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;
import java.util.Locale;

@Service
@RequiredArgsConstructor
public class AperturaCuentaService {
    private final JdbcTemplate jdbc;
    private final CuentaService cuentas;

    @Transactional
    public CuentaResponse crear(CrearCuentaDTO request, String clave) {
        if (clave == null) return cuentas.crear(request);
        if (!clave.matches("[A-Za-z0-9_-]{8,64}"))
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "La clave de solicitud no es válida.");
        var auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !(auth.getDetails() instanceof Number usuario))
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED);
        String huella = huella(request);
        // The unique row serializes concurrent retries in the same database transaction as account creation.
        jdbc.update("INSERT INTO aperturas_cuenta (usuario_ejecutor, clave, huella) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE clave = clave",
                usuario.longValue(), clave, huella);
        var anterior = jdbc.queryForMap("SELECT huella, cuenta_id FROM aperturas_cuenta WHERE usuario_ejecutor = ? AND clave = ? FOR UPDATE",
                usuario.longValue(), clave);
        if (!huella.equals(anterior.get("huella")))
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Esta clave ya corresponde a otra solicitud. Conserva sus datos originales.");
        if (anterior.get("cuenta_id") instanceof Number id) return cuentas.buscarPorId(id.longValue());
        CuentaResponse creado = cuentas.crear(request);
        jdbc.update("UPDATE aperturas_cuenta SET cuenta_id = ? WHERE usuario_ejecutor = ? AND clave = ?",
                creado.getId(), usuario.longValue(), clave);
        return creado;
    }

    private String huella(CrearCuentaDTO r) {
        String tipo = r.getTipoCuenta().trim().toUpperCase(Locale.ROOT);
        if (tipo.equals("AHORRO")) tipo = "AHORROS";
        String saldo = r.getSaldoInicial() == null ? "0" : r.getSaldoInicial().stripTrailingZeros().toPlainString();
        String datos = String.join("|", r.getUsuarioId().toString(), tipo, saldo, r.getMoneda().trim().toUpperCase(Locale.ROOT));
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(datos.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException ex) {
            throw new IllegalStateException(ex);
        }
    }
}
