package com.fintech.msprestamos.config.security;

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
                        .requestMatchers(HttpMethod.GET, "/api/prestamos/metricas").hasRole("ADMIN")
                        .requestMatchers(HttpMethod.GET, "/api/prestamos/*/evaluacion").hasRole("ADMIN")
                        .requestMatchers(HttpMethod.GET, "/api/prestamos/usuario/**").authenticated()
                        .requestMatchers(HttpMethod.GET, "/api/prestamos/*/detalle").authenticated()
                        .requestMatchers(HttpMethod.POST, "/api/prestamos/*/cancelar").authenticated()
                        .requestMatchers(HttpMethod.GET, "/api/prestamos/*").authenticated()
                        .requestMatchers(HttpMethod.GET, "/api/prestamos").hasRole("ADMIN")
                        .requestMatchers(HttpMethod.POST, "/api/prestamos").authenticated()
                        .requestMatchers(HttpMethod.PATCH, "/api/prestamos/*/revisar").hasRole("ADMIN")
                        .requestMatchers(HttpMethod.PATCH, "/api/prestamos/*/aprobar").hasRole("ADMIN")
                        .requestMatchers(HttpMethod.PATCH, "/api/prestamos/*/rechazar").hasRole("ADMIN")
                        .requestMatchers(HttpMethod.POST, "/api/prestamos/*/desembolsar").hasRole("ADMIN")
                        .requestMatchers(HttpMethod.POST, "/api/prestamos/*/pagar").authenticated()
                        .anyRequest().authenticated())
                .addFilterBefore(jwtAuthenticationFilter, UsernamePasswordAuthenticationFilter.class);
        return http.build();
    }

    @Bean
    CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration config = new CorsConfiguration();
        config.setAllowedOriginPatterns(List.of("*"));
        config.setAllowedMethods(List.of("GET", "POST", "PATCH", "OPTIONS"));
        config.setAllowedHeaders(List.of("*"));
        config.setAllowCredentials(false);
        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", config);
        return source;
    }
}
