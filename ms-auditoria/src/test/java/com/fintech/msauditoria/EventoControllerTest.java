package com.fintech.msauditoria;

import com.fintech.msauditoria.controller.AuditoriaController;
import com.fintech.msauditoria.service.*;
import com.fintech.msauditoria.config.GlobalExceptionHandler;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

class EventoControllerTest {
    MockMvc mvc;RecepcionEventos receptor;
    final String body="""
        {"eventoId":"evento-prueba","usuarioEjecutor":"admin","rolEjecutor":"ADMIN","accion":"ACTIVACION_CUENTA",
         "entidadAfectada":"CUENTA","entidadId":1,"detalles":"Detalle","fechaRegistro":"2026-11-17T12:00:00"}
        """;
    @BeforeEach void preparar() {
        receptor=mock(RecepcionEventos.class);
        var controller=new AuditoriaController(mock(AuditoriaService.class),receptor);
        ReflectionTestUtils.setField(controller,"key","clave-solo-de-prueba");
        mvc=MockMvcBuilders.standaloneSetup(controller).setControllerAdvice(new GlobalExceptionHandler()).build();
    }
    @Test void claveIncorrectaNoPersisteEventos()throws Exception {
        mvc.perform(post("/api/auditoria/internal/eventos").contentType("application/json").content(body)
            .header("X-Internal-Service","incorrecta")).andExpect(status().isForbidden());
        verifyNoInteractions(receptor);
    }
    @Test void faltaDeClaveNoProduceErrorInterno()throws Exception {
        mvc.perform(post("/api/auditoria/internal/eventos").contentType("application/json").content(body)).andExpect(status().isForbidden());
        verifyNoInteractions(receptor);
    }
    @Test void eventoValidoSeEntregaAlReceptor()throws Exception {
        mvc.perform(post("/api/auditoria/internal/eventos").contentType("application/json").content(body)
            .header("X-Internal-Service","clave-solo-de-prueba")).andExpect(status().isNoContent());
        verify(receptor).recibir(any());
    }
    @Test void contenidoIncompletoSeRechazaAntesDePersistir()throws Exception {
        mvc.perform(post("/api/auditoria/internal/eventos").contentType("application/json").content("{}")
            .header("X-Internal-Service","clave-solo-de-prueba")).andExpect(status().isBadRequest());
        verifyNoInteractions(receptor);
    }
}
