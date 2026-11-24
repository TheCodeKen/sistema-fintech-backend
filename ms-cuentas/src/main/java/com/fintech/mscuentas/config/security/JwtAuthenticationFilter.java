package com.fintech.mscuentas.config.security;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import javax.crypto.SecretKey;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.List;

@Component
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    @Value("${app.jwt.secret}")
    private String secret;

    @Value("${app.internal.service-key}") private String internalKey;

    @Value("${services.usuarios.url:http://localhost:8081}") private String usuariosUrl;

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {
        request.setAttribute("servicioInterno", false);
        String header = request.getHeader("Authorization");
        if (header != null && header.startsWith("Bearer ")) {
            try {
                Claims claims = Jwts.parser().verifyWith(signingKey()).build()
                        .parseSignedClaims(header.substring(7)).getPayload();
                try {
                    com.fintech.mscuentas.config.HttpClients.create(usuariosUrl).get().uri("/api/usuarios/internal/session")
                            .header("Authorization",header).header("X-Internal-Service",internalKey).retrieve().toBodilessEntity();
                } catch(org.springframework.web.client.RestClientException ex) { throw new IllegalArgumentException("Sesión inválida o servicio de identidad no disponible"); }
                String role = claims.get("rol", String.class);
                if (role != null) {
                    UsernamePasswordAuthenticationToken authentication =
                            new UsernamePasswordAuthenticationToken(
                                    claims.getSubject(), null,
                                    List.of(new SimpleGrantedAuthority("ROLE_" + role)));
                    authentication.setDetails(claims.get("userId", Long.class));
                    SecurityContextHolder.getContext().setAuthentication(authentication);
                    request.setAttribute("servicioInterno", !internalKey.isBlank() && internalKey.equals(request.getHeader("X-Internal-Service")));
                }
            } catch (JwtException | IllegalArgumentException ignored) {
                SecurityContextHolder.clearContext();
            }
        }
        filterChain.doFilter(request, response);
    }

    private SecretKey signingKey() {
        return Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
    }
}
