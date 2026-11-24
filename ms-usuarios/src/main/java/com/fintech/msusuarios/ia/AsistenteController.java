package com.fintech.msusuarios.ia;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;
import java.util.Map;

@RestController @RequestMapping("/api/usuarios/asistente") @RequiredArgsConstructor
public class AsistenteController {
    private final AsistenteService service;private final IaConfig config;private final IaHttp client;
    @GetMapping("/estado") public Map<String,Object> estado(HttpServletRequest http){
        var sesion=service.sesion(http.getHeader("Authorization"));
        boolean disponible=config.disponible();
        if(disponible && config.local()){
            try{
                var tags=client.enviar(config.getOllamaUrl().replaceAll("/+$","")+"/api/tags",Map.of(),null,System.nanoTime()+java.time.Duration.ofSeconds(3).toNanos(),true);
                disponible=false;for(var model:tags.path("models"))if(model.path("name").asText().equals(config.modeloActivo())){disponible=true;break;}
            }catch(org.springframework.web.server.ResponseStatusException ex){disponible=false;}
        }
        return Map.of("disponible",disponible,"proveedor",config.nombreProveedor(),"administrador",sesion.admin(),"procesamientoLocal",config.local());
    }
    @PostMapping("/chat") public AsistenteResponse chat(@Valid @RequestBody AsistenteRequest request,HttpServletRequest http){
        return service.conversar(request,service.sesion(http.getHeader("Authorization")));
    }
}
