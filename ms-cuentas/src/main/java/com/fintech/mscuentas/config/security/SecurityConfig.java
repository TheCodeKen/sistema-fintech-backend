package com.fintech.mscuentas.config.security;

import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
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
    SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http.csrf(AbstractHttpConfigurer::disable)
                .cors(cors -> cors.configurationSource(corsConfigurationSource()))
                .sessionManagement(sm -> sm.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .exceptionHandling(ex -> ex.authenticationEntryPoint(authenticationEntryPoint)
                        .accessDeniedHandler(accessDeniedHandler))
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers(HttpMethod.GET,"/health").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/cuentas/numero/**").authenticated()
                        .requestMatchers(HttpMethod.GET, "/api/cuentas/metricas").hasRole("ADMIN")
                        .requestMatchers(HttpMethod.GET, "/api/cuentas/usuario/**").authenticated()
                        .requestMatchers(HttpMethod.GET, "/api/cuentas/*").authenticated()
                        .requestMatchers(HttpMethod.GET, "/api/cuentas").hasRole("ADMIN")
                        .requestMatchers(HttpMethod.POST, "/api/cuentas").authenticated()
                        .requestMatchers(HttpMethod.PATCH, "/api/cuentas/*/activar").hasRole("ADMIN")
                        .requestMatchers(HttpMethod.PATCH, "/api/cuentas/*/bloquear").hasRole("ADMIN")
                        .requestMatchers(HttpMethod.PATCH, "/api/cuentas/*/congelar").hasRole("ADMIN")
                        .requestMatchers(HttpMethod.PATCH, "/api/cuentas/*/desbloquear").hasRole("ADMIN")
                        .requestMatchers(HttpMethod.PATCH, "/api/cuentas/*/cerrar").hasRole("ADMIN")
                        .requestMatchers(HttpMethod.PUT, "/api/cuentas/*/saldo").authenticated()
                        .requestMatchers(HttpMethod.DELETE, "/api/cuentas/**").hasRole("ADMIN")
                        .anyRequest().authenticated())
                .addFilterBefore(jwtAuthenticationFilter, UsernamePasswordAuthenticationFilter.class);
        return http.build();
    }

    @Bean
    CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration config = new CorsConfiguration();
        config.setAllowedOriginPatterns(List.of("*"));
        config.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
        config.setAllowedHeaders(List.of("*"));
        config.setAllowCredentials(false);
        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", config);
        return source;
    }
}
