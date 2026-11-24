package com.fintech.msprestamos.service;

import com.fintech.msprestamos.dto.PrestamoRequest;
import com.fintech.msprestamos.dto.PrestamoResponse;
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
public class SolicitudPrestamoService {
    private final JdbcTemplate jdbc;
    private final PrestamoService prestamos;

    @Transactional
    public PrestamoResponse crear(PrestamoRequest request, String clave) {
        if (clave == null) return prestamos.crear(request);
        if (!clave.matches("[A-Za-z0-9_-]{8,64}"))
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "La clave de solicitud no es válida.");
        var auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !(auth.getDetails() instanceof Number usuario))
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED);
        String huella = huella(request);
        // The unique row serializes concurrent retries in the same database transaction as loan creation.
        jdbc.update("INSERT INTO solicitudes_prestamo (usuario_ejecutor, clave, huella) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE clave = clave",
                usuario.longValue(), clave, huella);
        var anterior = jdbc.queryForMap("SELECT huella, prestamo_id FROM solicitudes_prestamo WHERE usuario_ejecutor = ? AND clave = ? FOR UPDATE",
                usuario.longValue(), clave);
        if (!huella.equals(anterior.get("huella")))
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Esta clave ya corresponde a otra solicitud. Conserva sus datos originales.");
        if (anterior.get("prestamo_id") instanceof Number id) return prestamos.buscarPorId(id.longValue());
        PrestamoResponse creado = prestamos.crear(request);
        jdbc.update("UPDATE solicitudes_prestamo SET prestamo_id = ? WHERE usuario_ejecutor = ? AND clave = ?",
                creado.getId(), usuario.longValue(), clave);
        return creado;
    }

    private String huella(PrestamoRequest r) {
        String datos = String.join("|", r.getUsuarioId().toString(), r.getCuentaDesembolsoId().toString(),
                r.getMontoSolicitado().stripTrailingZeros().toPlainString(),
                r.getTasaInteres().stripTrailingZeros().toPlainString(), r.getPlazoMeses().toString(),
                r.getTipoPrestamo().name(), r.getMoneda() == null ? "" : r.getMoneda().trim().toUpperCase(Locale.ROOT));
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(datos.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException ex) {
            throw new IllegalStateException(ex);
        }
    }
}
