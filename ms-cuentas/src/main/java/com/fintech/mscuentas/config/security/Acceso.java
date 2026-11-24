package com.fintech.mscuentas.config.security;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;
public final class Acceso {
    private Acceso() {}
    public static boolean interno() {
        var a = RequestContextHolder.getRequestAttributes();
        return a instanceof ServletRequestAttributes s && Boolean.TRUE.equals(s.getRequest().getAttribute("servicioInterno"));
    }
    public static boolean admin() {
        var a = SecurityContextHolder.getContext().getAuthentication();
        return a != null && a.getAuthorities().stream().anyMatch(r -> r.getAuthority().equals("ROLE_ADMIN"));
    }
    public static void propietario(Long id) {
        var a = SecurityContextHolder.getContext().getAuthentication();
        if (admin()) return;
        if (id == null || a == null || !(a.getDetails() instanceof Number n) || n.longValue() != id.longValue())
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "No tiene acceso a este recurso");
    }
    public static void lectura(Long id) { if (!interno()) propietario(id); }
    public static void soloInterno() { if (!interno()) throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Operación interna"); }
}
