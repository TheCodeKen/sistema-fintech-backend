package com.fintech.msusuarios;

import com.fintech.msusuarios.ia.*;
import com.fasterxml.jackson.databind.*;
import com.fintech.msusuarios.repository.UsuarioRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.mock.web.MockHttpServletRequest;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class OllamaTest {
    ObjectMapper json=new ObjectMapper();
    IaConfig config(){var c=new IaConfig();c.setProvider(IaConfig.Provider.OLLAMA);return c;}
    @Test void noNecesitaClaveYNuncaEnviaLaDeOpenAI()throws Exception{
        var c=config();c.setApiKey("secreto-que-no-debe-salir");var http=mock(IaHttp.class);
        when(http.enviar(eq("http://localhost:11434/v1/responses"),eq(Map.of()),any(),anyLong(),eq(true))).thenReturn(json.readTree("{\"status\":\"completed\",\"output\":[{\"type\":\"message\",\"content\":[{\"type\":\"output_text\",\"text\":\"Respuesta local\"}]}]}"));
        var tools=new IaHerramientas(c,http,json,mock(UsuarioRepository.class));var service=new AsistenteService(c,http,tools,new IaLimite(),json);
        assertTrue(c.disponible());var response=service.conversar(new AsistenteRequest("Hola",AsistenteRequest.Modo.CLIENTE,false,List.of()),new IaHerramientas.Sesion(1L,false,"Bearer jwt"));assertEquals("Respuesta local",response.respuesta());
        verify(http).enviar(eq(c.endpoint()),eq(Map.of()),argThat(body->body.path("model").asText().equals("qwen3:4b-instruct-2507-q4_K_M") && !body.has("include") && !body.has("store") && !body.path("think").asBoolean() && !body.toString().contains("secreto")),anyLong(),eq(true));
    }
    @ParameterizedTest @ValueSource(strings={"https://api.openai.com","http://evil.test:11434","http:///missing","http://ollama:11434/?token=secret"})
    void noAceptaEndpointsExternosEnModoLocal(String url){var c=config();c.setOllamaUrl(url);assertFalse(c.disponible());}
    @Test void noAceptaModelosCloud(){var c=config();c.setOllamaModel("modelo:cloud");assertFalse(c.disponible());}
    @Test void disponibilidadCompruebaQueElModeloEsteDescargado()throws Exception{
        var c=config();var http=mock(IaHttp.class);var service=mock(AsistenteService.class);when(service.sesion("Bearer test")).thenReturn(new IaHerramientas.Sesion(1L,false,"Bearer test"));
        var request=new MockHttpServletRequest();request.addHeader("Authorization","Bearer test");var controller=new AsistenteController(service,c,http);
        when(http.enviar(anyString(),eq(Map.of()),isNull(),anyLong(),eq(true))).thenReturn(json.readTree("{\"models\":[]}"),json.readTree("{\"models\":[{\"name\":\"qwen3:4b-instruct-2507-q4_K_M\"}]}"));
        assertEquals(false,controller.estado(request).get("disponible"));var state=controller.estado(request);assertEquals(true,state.get("disponible"));assertEquals(true,state.get("procesamientoLocal"));assertEquals("Ollama local",state.get("proveedor"));
    }
}
