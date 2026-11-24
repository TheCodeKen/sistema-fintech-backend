package com.fintech.msauditoria.config.security;

import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.*;
import java.util.List;

@Configuration
@RequiredArgsConstructor
public class SecurityConfig {
    private final JwtAuthenticationFilter jwt;
    private final CustomAuthenticationEntryPoint entryPoint;
    private final CustomAccessDeniedHandler denied;
    @Bean
    SecurityFilterChain filter(HttpSecurity http)throws Exception {
        return http.csrf(AbstractHttpConfigurer::disable).cors(c->c.configurationSource(cors()))
            .sessionManagement(s->s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .exceptionHandling(e->e.authenticationEntryPoint(entryPoint).accessDeniedHandler(denied))
            .authorizeHttpRequests(a->a.requestMatchers(HttpMethod.GET,"/health").permitAll()
                .requestMatchers(HttpMethod.POST,"/api/auditoria/internal/eventos").permitAll()
                .requestMatchers(HttpMethod.GET,"/api/auditoria").hasRole("ADMIN")
                .requestMatchers(HttpMethod.POST,"/api/auditoria/internal").authenticated()
                .anyRequest().denyAll())
            .addFilterBefore(jwt,UsernamePasswordAuthenticationFilter.class).build();
    }
    @Bean
    CorsConfigurationSource cors() {
        var config=new CorsConfiguration();config.setAllowedOriginPatterns(List.of("*"));
        config.setAllowedMethods(List.of("GET","POST","OPTIONS"));config.setAllowedHeaders(List.of("*"));
        var source=new UrlBasedCorsConfigurationSource();source.registerCorsConfiguration("/**",config);return source;
    }
}
