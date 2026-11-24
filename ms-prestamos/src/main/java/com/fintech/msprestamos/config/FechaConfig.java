package com.fintech.msprestamos.config;
import java.time.Clock;
import java.time.ZoneId;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
@Configuration
public class FechaConfig {
    @Bean public Clock relojPrestamos() { return Clock.system(ZoneId.of("America/Lima")); }
}
