package com.fintech.msusuarios.ia;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

@Component @ConfigurationProperties(prefix="app.ia") @Data
public class IaConfig {
    public enum Provider {OPENAI,OLLAMA}
    private Provider provider=Provider.OPENAI;
    private boolean enabled=true;
    @lombok.ToString.Exclude private String apiKey="";
    private String model="gpt-5.4-mini";
    private String responsesUrl="https://api.openai.com/v1/responses";
    private String ollamaUrl="http://localhost:11434";
    private String ollamaModel="qwen3:4b-instruct-2507-q4_K_M";
    private String cuentasUrl="http://localhost:8082";
    private String transaccionesUrl="http://localhost:8083";
    private String prestamosUrl="http://localhost:8084";
    public boolean local(){return provider==Provider.OLLAMA;}
    public String nombreProveedor(){return local() ? "Ollama local" : "OpenAI";}
    public String modeloActivo(){return local() ? ollamaModel : model;}
    public String endpoint(){return local() ? ollamaUrl.replaceAll("/+$","")+"/v1/responses" : responsesUrl;}
    public boolean disponible(){return enabled && (local() ? localValido() : !apiKey.isBlank());}
    public boolean localValido(){
        try{
            var uri=java.net.URI.create(ollamaUrl);
            return "http".equals(uri.getScheme()) && uri.getHost()!=null && java.util.Set.of("localhost","127.0.0.1","[::1]","ollama","host.docker.internal").contains(uri.getHost())
                    && uri.getUserInfo()==null && uri.getQuery()==null && uri.getFragment()==null && (uri.getPath().isEmpty() || uri.getPath().equals("/"))
                    && !ollamaModel.isBlank() && !ollamaModel.toLowerCase(java.util.Locale.ROOT).contains("cloud");
        }catch(IllegalArgumentException ex){return false;}
    }
}
