package com.fintech.msusuarios;
import com.fintech.msusuarios.ia.IaHttp;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.web.server.ResponseStatusException;
import java.net.InetSocketAddress;
import java.time.Duration;
import java.util.Map;
import static org.junit.jupiter.api.Assertions.*;
class IaHttpTest {
    @ParameterizedTest @ValueSource(strings={"{\"code\":\"credit_balance_exhausted\"}","{\"code\":\"insufficient_quota\"}","{\"type\":\"insufficient_quota\"}"})
    void distingueSaldoAgotadoDeUnLimiteTemporal(String error)throws Exception{
        var server=HttpServer.create(new InetSocketAddress("127.0.0.1",0),0);
        server.createContext("/test",e->{byte[] bytes=("{\"error\":"+error+"}").getBytes();e.sendResponseHeaders(429,bytes.length);e.getResponseBody().write(bytes);e.close();});server.start();
        try{var client=new IaHttp(new ObjectMapper());var ex=assertThrows(ResponseStatusException.class,()->client.enviar("http://127.0.0.1:"+server.getAddress().getPort()+"/test",Map.of(),null,System.nanoTime()+Duration.ofSeconds(5).toNanos(),true));assertEquals(429,ex.getStatusCode().value());assertTrue(ex.getReason().contains("créditos"));assertFalse(ex.getReason().contains("clave-secreta"));}finally{server.stop(0);}
    }
    @Test void limiteTemporalIndicaReintentarSinPedirRecarga()throws Exception{
        var server=HttpServer.create(new InetSocketAddress("127.0.0.1",0),0);
        server.createContext("/test",e->{byte[] bytes="{\"error\":{\"code\":\"rate_limit_exceeded\"}}".getBytes();e.sendResponseHeaders(429,bytes.length);e.getResponseBody().write(bytes);e.close();});server.start();
        try{var client=new IaHttp(new ObjectMapper());var ex=assertThrows(ResponseStatusException.class,()->client.enviar("http://127.0.0.1:"+server.getAddress().getPort()+"/test",Map.of(),null,System.nanoTime()+Duration.ofSeconds(5).toNanos(),true));assertEquals(429,ex.getStatusCode().value());assertTrue(ex.getReason().contains("temporal"));assertFalse(ex.getReason().contains("facturación"));}finally{server.stop(0);}
    }
    @Test void noFiltraCredencialesNiErroresCrudosDelProveedor()throws Exception{
        var server=HttpServer.create(new InetSocketAddress("127.0.0.1",0),0);
        server.createContext("/test",e->{byte[] data="{\"error\":\"clave-secreta-no-publicar\"}".getBytes();e.sendResponseHeaders(401,data.length);e.getResponseBody().write(data);e.close();});server.start();
        try{var client=new IaHttp(new ObjectMapper());var ex=assertThrows(ResponseStatusException.class,()->client.enviar("http://127.0.0.1:"+server.getAddress().getPort()+"/test",Map.of(),null,System.nanoTime()+Duration.ofSeconds(5).toNanos(),true));assertEquals(503,ex.getStatusCode().value());assertFalse(ex.getReason().contains("clave-secreta"));}
        finally{server.stop(0);}
    }
    @Test void tiempoMaximoIncluyeCuerpoLento()throws Exception{
        var server=HttpServer.create(new InetSocketAddress("127.0.0.1",0),0);
        server.createContext("/test",e->{e.sendResponseHeaders(200,0);try{Thread.sleep(700);e.getResponseBody().write("{}".getBytes());}catch(Exception ignored){}finally{e.close();}});server.start();
        try{var client=new IaHttp(new ObjectMapper());assertTimeoutPreemptively(Duration.ofSeconds(2),()->{
            var ex=assertThrows(ResponseStatusException.class,()->client.enviar("http://127.0.0.1:"+server.getAddress().getPort()+"/test",Map.of(),null,System.nanoTime()+Duration.ofMillis(150).toNanos(),true));assertEquals(504,ex.getStatusCode().value());
        });}finally{server.stop(0);}
    }
    @Test void limitaElTamanoDeLasRespuestas()throws Exception{
        var server=HttpServer.create(new InetSocketAddress("127.0.0.1",0),0);
        server.createContext("/test",e->{byte[] bytes=new byte[1_048_577];e.sendResponseHeaders(200,bytes.length);try{e.getResponseBody().write(bytes);}finally{e.close();}});server.start();
        try{var client=new IaHttp(new ObjectMapper());assertThrows(ResponseStatusException.class,()->client.enviar("http://127.0.0.1:"+server.getAddress().getPort()+"/test",Map.of(),null,System.nanoTime()+Duration.ofSeconds(5).toNanos(),true));}finally{server.stop(0);}
    }
}
