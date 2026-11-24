package com.fintech.msusuarios.controller;
import com.fintech.msusuarios.config.security.Acceso;
import org.springframework.web.bind.annotation.*;
@RestController @RequestMapping("/api/usuarios/internal/session")
public class SessionController {
    @GetMapping public java.util.Map<String,Boolean> verificar() { Acceso.soloInterno(); return java.util.Map.of("valid",true); }
}
