package com.fintech.msusuarios.ia;

import org.springframework.stereotype.Component;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;
import java.util.concurrent.*;

@Component
public class IaLimite {
    private record Ventana(long inicio,int peticiones){}
    private final ConcurrentHashMap<Long,Ventana> ventanas=new ConcurrentHashMap<>();
    private final java.util.Set<Long> activos=ConcurrentHashMap.newKeySet();
    private final Semaphore global=new Semaphore(4);
    public AutoCloseable iniciar(Long usuario){
        if(!activos.add(usuario))throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS,"Ya tienes una consulta en curso.");
        if(!global.tryAcquire()){activos.remove(usuario);throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS,"El asistente está ocupado. Intenta en unos segundos.");}
        long ahora=System.nanoTime();
        ventanas.entrySet().removeIf(e->ahora-e.getValue().inicio()>TimeUnit.MINUTES.toNanos(2));
        var ventana=ventanas.compute(usuario,(id,prev)->prev==null || ahora-prev.inicio()>TimeUnit.MINUTES.toNanos(1) ? new Ventana(ahora,1) : new Ventana(prev.inicio(),prev.peticiones()+1));
        if(ventana.peticiones()>6){activos.remove(usuario);global.release();throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS,"Alcanzaste el límite de seis consultas por minuto. Espera antes de continuar.");}
        return ()->{activos.remove(usuario);global.release();};
    }
}
