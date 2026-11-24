package com.fintech.msusuarios.controller;

import com.fintech.msusuarios.dto.*;
import com.fintech.msusuarios.service.NotificacionService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.Page;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import java.util.Map;

@RestController @RequestMapping("/api/usuarios/notificaciones") @RequiredArgsConstructor
public class NotificacionController {
    private final NotificacionService service;
    @Value("${app.internal.service-key}") private String key;
    @GetMapping public Page<NotificacionResponse> listar(@RequestParam(defaultValue="false") boolean noLeidas,
            @RequestParam(defaultValue="0") int page,@RequestParam(defaultValue="10") int size){return service.listar(noLeidas,page,size);}
    @GetMapping("/resumen") public Map<String,Long> resumen(){return Map.of("noLeidas",service.noLeidas());}
    @PatchMapping("/{id}/leer") @ResponseStatus(HttpStatus.NO_CONTENT) public void leer(@PathVariable Long id){service.leer(id);}
    public record LecturaMasiva(@NotNull @Positive Long hastaId){}
    @PatchMapping("/leer-todas") @ResponseStatus(HttpStatus.NO_CONTENT)
    public void leerTodas(@Valid @RequestBody LecturaMasiva r){service.leerTodas(r.hastaId());}
    @PostMapping("/internal/eventos") @ResponseStatus(HttpStatus.NO_CONTENT)
    public void recibir(@Valid @RequestBody NotificacionEvento evento,@RequestHeader(value="X-Internal-Service",required=false) String received){
        if(key.isBlank() || !key.equals(received))throw new ResponseStatusException(HttpStatus.FORBIDDEN,"Operación interna");
        service.recibir(evento);
    }
}
