package com.fintech.mscuentas.config;
public final class HttpClients {
    private HttpClients() {}
    public static org.springframework.web.client.RestClient create(String url) {
        var factory=new org.springframework.http.client.SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(5000); factory.setReadTimeout(5000);
        return org.springframework.web.client.RestClient.builder().baseUrl(url).requestFactory(factory).build();
    }
}
