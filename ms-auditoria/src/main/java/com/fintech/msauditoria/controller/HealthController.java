package com.fintech.msauditoria.controller;
import org.springframework.web.bind.annotation.*;
import org.springframework.jdbc.core.JdbcTemplate;
@RestController
public class HealthController {
    private final JdbcTemplate jdbc;
    public HealthController(JdbcTemplate jdbc) { this.jdbc=jdbc; }
    @GetMapping("/health") public java.util.Map<String,String> health() {
        jdbc.queryForObject("SELECT 1",Integer.class);
        return java.util.Map.of("status","UP");
    }
}
