package com.fintech.msusuarios.ia;

import java.util.List;
public record AsistenteResponse(String respuesta,AsistenteRequest.Modo modo,List<Fuente> fuentes,boolean datosConsultados) {
    public record Fuente(String titulo,String enlace){}
}
