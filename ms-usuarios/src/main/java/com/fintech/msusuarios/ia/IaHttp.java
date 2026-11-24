package com.fintech.msusuarios.ia;

import com.fasterxml.jackson.databind.*;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;
import java.net.URI;
import java.net.http.*;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Map;
import java.util.List;
import java.nio.ByteBuffer;
import java.util.concurrent.*;

/** No redirects, arbitrary user URLs, request logging or automatic retries. */
@Component @RequiredArgsConstructor
public class IaHttp {
    private final ObjectMapper json;
    private final HttpClient client=HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(3)).build();
    public JsonNode enviar(String url,Map<String,String> headers,JsonNode body,long deadline,boolean proveedor){
        long remaining=deadline-System.nanoTime();
        if(remaining<=0)throw new ResponseStatusException(HttpStatus.GATEWAY_TIMEOUT,"La consulta tardó demasiado. Intenta con una pregunta más concreta.");
        try{
            var builder=HttpRequest.newBuilder(URI.create(url)).timeout(Duration.ofNanos(Math.min(remaining,Duration.ofSeconds(proveedor?25:6).toNanos()))).header("Accept","application/json");
            headers.forEach(builder::header);
            if(body==null)builder.GET();else builder.header("Content-Type","application/json").POST(HttpRequest.BodyPublishers.ofString(json.writeValueAsString(body)));
            var pending=client.sendAsync(builder.build(),info->new CuerpoLimitado());
            HttpResponse<byte[]> response;
            try{response=pending.get(Math.min(remaining,Duration.ofSeconds(proveedor?25:6).toNanos()),TimeUnit.NANOSECONDS);}
            catch(TimeoutException ex){pending.cancel(true);throw new ResponseStatusException(HttpStatus.GATEWAY_TIMEOUT,"La consulta tardó demasiado. Intenta con una pregunta más concreta.");}
                int status=response.statusCode();
                if(status<200 || status>=300){
                    if(proveedor){
                        // Inspect only structured error codes; never expose provider messages or credentials.
                        JsonNode error;
                        try{JsonNode parsed=json.readTree(response.body());error=parsed==null ? json.createObjectNode() : parsed.path("error");}catch(IOException ex){error=json.createObjectNode();}
                        String code=error.path("code").asText(),type=error.path("type").asText();
                        if(status==429 && (code.equals("credit_balance_exhausted") || code.equals("insufficient_quota") || type.equals("insufficient_quota")))
                            throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS,"OpenAI no tiene saldo o cuota de API disponible. El administrador debe revisar la facturación y los créditos del proyecto de OpenAI.");
                        if(status==429)throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS,"OpenAI alcanzó su límite temporal de solicitudes. Espera un momento antes de reintentar.");
                        if(status==401)throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,"OpenAI rechazó la credencial del servidor. El administrador debe revisar la clave de API configurada.");
                    }
                    if(!proveedor && (status==401 || status==403 || status==404))throw new ResponseStatusException(HttpStatus.valueOf(status),"No puedes consultar ese recurso o tu sesión ya no está disponible.");
                    throw new ResponseStatusException(status==429 ? HttpStatus.TOO_MANY_REQUESTS : HttpStatus.SERVICE_UNAVAILABLE,
                            proveedor ? "El proveedor de IA no está disponible o su configuración requiere revisión. Intenta más tarde." : "No se pudieron consultar los datos del proyecto. Intenta nuevamente.");
                }
                byte[] bytes=response.body();
                return json.readTree(new String(bytes,StandardCharsets.UTF_8));
        }catch(ResponseStatusException ex){throw ex;}
        catch(InterruptedException ex){Thread.currentThread().interrupt();throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,"La consulta fue interrumpida.");}
        catch(IOException|IllegalArgumentException|ExecutionException ex){throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,"No se pudo conectar con el servicio del asistente. Intenta más tarde.");}
    }
    private static final class CuerpoLimitado implements HttpResponse.BodySubscriber<byte[]> {
        private final CompletableFuture<byte[]> body=new CompletableFuture<>();
        private final ByteArrayOutputStream bytes=new ByteArrayOutputStream();
        private Flow.Subscription subscription;
        public CompletionStage<byte[]> getBody(){return body;}
        public void onSubscribe(Flow.Subscription s){subscription=s;s.request(1);}
        public void onNext(List<ByteBuffer> buffers){
            for(ByteBuffer buffer:buffers){
                if(bytes.size()+buffer.remaining()>1_048_576){subscription.cancel();body.completeExceptionally(new IOException("Response size exceeded"));return;}
                byte[] chunk=new byte[buffer.remaining()];buffer.get(chunk);bytes.writeBytes(chunk);
            }subscription.request(1);
        }
        public void onError(Throwable error){body.completeExceptionally(error);}
        public void onComplete(){body.complete(bytes.toByteArray());}
    }
}
