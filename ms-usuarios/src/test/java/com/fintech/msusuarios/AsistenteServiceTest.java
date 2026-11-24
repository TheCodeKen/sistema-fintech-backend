package com.fintech.msusuarios;

import com.fasterxml.jackson.databind.*;
import com.fintech.msusuarios.ia.*;
import com.fintech.msusuarios.repository.UsuarioRepository;
import org.junit.jupiter.api.*;
import org.springframework.web.server.ResponseStatusException;
import java.util.*;
import static org.mockito.Mockito.*;
import static org.junit.jupiter.api.Assertions.*;

class AsistenteServiceTest {
    ObjectMapper json=new ObjectMapper();IaConfig config;IaHttp http;IaHerramientas tools;AsistenteService service;
    final IaHerramientas.Sesion cliente=new IaHerramientas.Sesion(2L,false,"Bearer jwt-del-usuario");
    JsonNode node(String s)throws Exception{return json.readTree(s);}
    AsistenteRequest request(boolean datos){return new AsistenteRequest("Resume mis cuentas",AsistenteRequest.Modo.CLIENTE,datos,List.of());}
    JsonNode llamada(String name,String args){var n=json.createObjectNode();n.put("status","completed");var c=n.putArray("output").addObject();c.put("type","function_call");c.put("call_id","call_1");c.put("name",name);c.put("arguments",args);return n;}
    JsonNode respuesta(){var n=json.createObjectNode();n.put("status","completed");var m=n.putArray("output").addObject();m.put("type","message");m.putArray("content").addObject().put("type","output_text").put("text","Tu cuenta tiene PEN 100.00 disponibles.");return n;}
    @BeforeEach void init(){config=new IaConfig();config.setApiKey("clave-prueba");http=mock(IaHttp.class);tools=new IaHerramientas(config,http,json,mock(UsuarioRepository.class));service=new AsistenteService(config,http,tools,new IaLimite(),json);}
    @Test void sinClaveNoLlamaAlProveedor(){config.setApiKey("");assertEquals(503,assertThrows(ResponseStatusException.class,()->service.conversar(request(true),cliente)).getStatusCode().value());verifyNoInteractions(http);}
    @Test void clienteNoSeleccionaAgenteAdministrador(){var r=new AsistenteRequest("Resume alertas",AsistenteRequest.Modo.ADMIN,true,List.of());assertEquals(403,assertThrows(ResponseStatusException.class,()->service.conversar(r,cliente)).getStatusCode().value());verifyNoInteractions(http);}
    @Test void consentimientoDesactivadoImpideHerramientasDeDatos(){
        when(http.enviar(eq(config.getResponsesUrl()),anyMap(),any(),anyLong(),eq(true))).thenReturn(llamada("mis_cuentas","{}"));
        assertEquals(403,assertThrows(ResponseStatusException.class,()->service.conversar(request(false),cliente)).getStatusCode().value());verify(http,never()).enviar(anyString(),anyMap(),isNull(),anyLong(),eq(false));
    }
    @Test void consultaPropiaUsaJwtYEnviaSoloCamposReducidosAlProveedor()throws Exception{
        var enviados=new ArrayList<JsonNode>();
        when(http.enviar(eq(config.getResponsesUrl()),anyMap(),any(),anyLong(),eq(true))).thenAnswer(inv->{enviados.add(((JsonNode)inv.getArgument(2)).deepCopy());return enviados.size()==1?llamada("mis_cuentas","{}"):respuesta();});
        when(http.enviar(eq(config.getCuentasUrl()+"/api/cuentas/usuario/2"),eq(Map.of("Authorization","Bearer jwt-del-usuario")),isNull(),anyLong(),eq(false)))
            .thenReturn(node("[{\"id\":1,\"usuarioId\":2,\"numeroCuenta\":\"FT12345678\",\"saldo\":100,\"moneda\":\"PEN\",\"estado\":\"ACTIVA\",\"email\":\"privado@example.test\",\"nombre\":\"Persona privada\"}]"));
        var r=new AsistenteRequest("Mi correo es privado@example.test y mi cuenta FT12345678",AsistenteRequest.Modo.CLIENTE,true,List.of());
        var result=service.conversar(r,cliente);assertTrue(result.datosConsultados());assertEquals("/cuentas",result.fuentes().get(0).enlace());
        String wire=enviados.toString();assertFalse(wire.contains("privado@example.test"));assertFalse(wire.contains("FT12345678"));assertFalse(wire.contains("Persona privada"));assertFalse(wire.contains("jwt-del-usuario"));assertTrue(wire.contains("****5678"));
        for(JsonNode body:enviados){assertFalse(body.path("store").asBoolean());assertTrue(body.path("max_output_tokens").asInt()<=1800);}
        verify(http,times(2)).enviar(eq(config.getResponsesUrl()),eq(Map.of("Authorization","Bearer clave-prueba")),any(),anyLong(),eq(true));
    }
    @Test void proveedorNoPuedeSolicitarTransferencias(){when(http.enviar(anyString(),anyMap(),any(),anyLong(),eq(true))).thenReturn(llamada("transferir","{}"));assertEquals(403,assertThrows(ResponseStatusException.class,()->service.conversar(request(true),cliente)).getStatusCode().value());}
    @Test void noAceptaUrlsOArgumentosExtraDelModelo(){when(http.enviar(anyString(),anyMap(),any(),anyLong(),eq(true))).thenReturn(llamada("detalle_movimiento","{\"id\":1,\"url\":\"http://evil\"}"));assertEquals(502,assertThrows(ResponseStatusException.class,()->service.conversar(request(true),cliente)).getStatusCode().value());verify(http,never()).enviar(anyString(),anyMap(),isNull(),anyLong(),eq(false));}
    @Test void guiaNoConsultaDatosYConservaLaContinuacionDeHerramientas(){
        var requests=new ArrayList<JsonNode>();
        when(http.enviar(anyString(),anyMap(),any(),anyLong(),eq(true))).thenAnswer(inv->{requests.add(((JsonNode)inv.getArgument(2)).deepCopy());return requests.size()==1?llamada("consultar_guia","{}"):respuesta();});
        var r=service.conversar(request(false),cliente);assertFalse(r.datosConsultados());assertFalse(r.fuentes().isEmpty());assertTrue(requests.get(1).path("input").toString().contains("function_call_output"));verify(http,never()).enviar(anyString(),anyMap(),isNull(),anyLong(),eq(false));
    }
    @Test void respuestaIncompletaNoSePresentaComoValida()throws Exception{when(http.enviar(anyString(),anyMap(),any(),anyLong(),eq(true))).thenReturn(node("{\"status\":\"incomplete\",\"output\":[]}"));assertEquals(502,assertThrows(ResponseStatusException.class,()->service.conversar(request(true),cliente)).getStatusCode().value());}
    @Test void datosAjenosDenegadosNoLleganAlProveedor(){
        when(http.enviar(eq(config.getResponsesUrl()),anyMap(),any(),anyLong(),eq(true))).thenReturn(llamada("detalle_movimiento","{\"id\":99}"));
        when(http.enviar(eq(config.getTransaccionesUrl()+"/api/transacciones/99/detalle"),anyMap(),isNull(),anyLong(),eq(false))).thenThrow(new ResponseStatusException(org.springframework.http.HttpStatus.FORBIDDEN,"Sin acceso"));
        assertEquals(403,assertThrows(ResponseStatusException.class,()->service.conversar(request(true),cliente)).getStatusCode().value());verify(http,times(1)).enviar(eq(config.getResponsesUrl()),anyMap(),any(),anyLong(),eq(true));
    }
    @Test void redaccionEvitaCredencialesYTokens(){String s=IaPrivacidad.texto("password=secreto privado@example.test FT12345678 ft87654321 Bearer tokenprivado sk-abcdefghijklmnop");assertFalse(s.contains("secreto"));assertFalse(s.contains("tokenprivado"));assertFalse(s.contains("abcdefghijklmnop"));assertFalse(s.contains("ft87654321"));assertTrue(s.contains("****5678"));assertTrue(s.contains("****4321"));}
}
