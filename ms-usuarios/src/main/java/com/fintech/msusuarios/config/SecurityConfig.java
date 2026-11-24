package com.fintech.msusuarios.config;

import com.fintech.msusuarios.config.security.CustomAccessDeniedHandler;
import com.fintech.msusuarios.config.security.CustomAuthenticationEntryPoint;
import com.fintech.msusuarios.config.security.JwtAuthenticationFilter;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.List;

@Configuration
@EnableWebSecurity
@RequiredArgsConstructor
public class SecurityConfig {

    private final JwtAuthenticationFilter jwtAuthenticationFilter;
    private final CustomAuthenticationEntryPoint authenticationEntryPoint;
    private final CustomAccessDeniedHandler accessDeniedHandler;

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
            .csrf(AbstractHttpConfigurer::disable)
            .cors(cors -> cors.configurationSource(corsConfigurationSource()))
            .sessionManagement(sm -> sm.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .exceptionHandling(ex -> ex.authenticationEntryPoint(authenticationEntryPoint)
                .accessDeniedHandler(accessDeniedHandler))
            .authorizeHttpRequests(auth -> auth
                        .requestMatchers(HttpMethod.GET,"/health").permitAll()

                // ── Rutas públicas ─────────────────────────────────────────
                .requestMatchers(HttpMethod.POST, "/api/usuarios/login").permitAll()
                .requestMatchers(HttpMethod.POST, "/api/usuarios/registro").permitAll()
                .requestMatchers(HttpMethod.POST, "/api/usuarios/password/forgot").permitAll()
                .requestMatchers(HttpMethod.POST, "/api/usuarios/password/reset").permitAll()
                .requestMatchers(HttpMethod.POST, "/api/usuarios/notificaciones/internal/eventos").permitAll()
                 .requestMatchers(HttpMethod.POST, "/api/auditoria/internal/eventos").permitAll()
                .requestMatchers(HttpMethod.GET, "/api/auditoria").hasRole("ADMIN")
                .requestMatchers(HttpMethod.POST, "/api/auditoria/internal").authenticated()
                .requestMatchers(HttpMethod.GET, "/api/usuarios/metricas").hasRole("ADMIN")

                // ── Consulta por ID: permitida para llamadas internas (FeignClient) ──
                // ms-prestamos llama GET /api/usuarios/{id} para validar usuario
                .requestMatchers(HttpMethod.GET, "/api/usuarios/{id}").authenticated()

                // ── Rutas solo ADMIN ───────────────────────────────────────
                .requestMatchers(HttpMethod.GET,    "/api/usuarios").hasRole("ADMIN")
                .requestMatchers(HttpMethod.POST,   "/api/usuarios").hasRole("ADMIN")
                .requestMatchers(HttpMethod.PATCH,  "/api/usuarios/*/estado").hasRole("ADMIN")
                .requestMatchers(HttpMethod.PUT,    "/api/usuarios/**").hasRole("ADMIN")
                .requestMatchers(HttpMethod.DELETE, "/api/usuarios/**").hasRole("ADMIN")

                // ── Cualquier otra ruta autenticada ────────────────────────
                .anyRequest().authenticated()
            )
            .addFilterBefore(jwtAuthenticationFilter, UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration config = new CorsConfiguration();
        // Permitir Angular + llamadas internas entre microservicios
        config.setAllowedOriginPatterns(List.of("*"));
        config.setAllowedMethods(List.of("GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"));
        config.setAllowedHeaders(List.of("*"));
        // false porque usamos allowedOriginPatterns("*") — no se puede combinar con credentials=true y wildcard
        config.setAllowCredentials(false);
        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", config);
        return source;
    }
}
