package com.fintech.msusuarios.ia;

import com.fasterxml.jackson.databind.*;
import com.fasterxml.jackson.databind.node.*;
import com.fintech.msusuarios.repository.UsuarioRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;
import java.util.*;
import java.util.stream.StreamSupport;

/** Every business request is GET and uses the caller's JWT, never the internal service credential. */
@Component @RequiredArgsConstructor
public class IaHerramientas {
    private final IaConfig config;private final IaHttp http;private final ObjectMapper json;private final UsuarioRepository usuarios;
    public record Sesion(Long usuario,boolean admin,String authorization){}
    private static final Map<String,String> DESCRIPCIONES=Map.of(
        "consultar_guia","Reglas oficiales de los formularios de cuentas, transferencias y préstamos del proyecto.",
        "mis_cuentas","Consulta cuentas propias con número enmascarado, moneda y saldo.",
        "mis_movimientos","Consulta una muestra de movimientos propios recientes, no un estado de cuenta completo.",
        "mis_prestamos","Consulta una muestra de préstamos propios recientes.",
        "detalle_movimiento","Explica un movimiento por ID, sujeto a los permisos del usuario.",
        "detalle_prestamo","Consulta saldo, próxima cuota y cuotas de un préstamo autorizado por ID.",
        "resumen_operativo","Métricas agregadas de usuarios, cuentas y préstamos; solo administradores.",
        "alertas_pendientes","Muestra de alertas pendientes de revisión sin datos identificatorios personales; solo administradores.",
        "solicitudes_prestamo","Muestra de solicitudes pendientes o en revisión; solo administradores.");
    public Set<String> nombres(AsistenteRequest.Modo modo,boolean datos){
        var names=new LinkedHashSet<String>();names.add("consultar_guia");
        if(datos){
            names.addAll(modo==AsistenteRequest.Modo.ADMIN ? List.of("resumen_operativo","alertas_pendientes","solicitudes_prestamo") : List.of("mis_cuentas","mis_movimientos","mis_prestamos"));
            names.addAll(List.of("detalle_movimiento","detalle_prestamo"));
        }return names;
    }
    public ArrayNode esquemas(AsistenteRequest.Modo modo,boolean datos){
        var out=json.createArrayNode();
        for(String name:nombres(modo,datos)){
            boolean id=name.startsWith("detalle_");var params=json.createObjectNode();params.put("type","object");params.put("additionalProperties",false);
            var properties=params.putObject("properties");var required=params.putArray("required");
            if(id){properties.putObject("id").put("type","integer").put("minimum",1);required.add("id");}
            var tool=out.addObject();tool.put("type","function");tool.put("name",name);tool.put("description",DESCRIPCIONES.get(name));tool.put("strict",true);tool.set("parameters",params);
        }return out;
    }
    public JsonNode ejecutar(String name,JsonNode args,Sesion sesion,AsistenteRequest.Modo modo,boolean datos,
            Map<String,AsistenteResponse.Fuente> fuentes,long deadline){
        if(modo==AsistenteRequest.Modo.ADMIN && !sesion.admin() || !nombres(modo,datos).contains(name))
            throw new ResponseStatusException(HttpStatus.FORBIDDEN,"La herramienta solicitada no está autorizada.");
        boolean byId=name.startsWith("detalle_");
        if(!args.isObject() || args.size()!=(byId?1:0) || byId && (!args.path("id").canConvertToLong() || !args.path("id").isIntegralNumber() || args.path("id").asLong()<=0))
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY,"El asistente solicitó una consulta inválida. Reformula la pregunta.");
        long id=args.path("id").asLong();
        switch(name){
            case "consultar_guia":
                fuente(fuentes,"Formularios de movimientos","/transacciones");fuente(fuentes,"Formulario de préstamos","/prestamos");
                return json.valueToTree(Map.of("cuentas","Apertura en PEN o USD con saldo inicial cero para clientes. Requiere activación administrativa.",
                    "transferencias","Cuenta activa, destino distinto y activo, misma moneda, importe positivo con hasta dos decimales y saldo suficiente. Revisar antes de confirmar. No hay conversión de moneda.",
                    "prestamos","Tasa cliente 18% anual, cuotas fijas con intereses pactados, pagos parciales aplicados a cuotas antiguas. Cronograma desde desembolso. No se añaden recargos por vencimiento. Cliente cancela solo pendientes o en revisión; administrador también aprobados antes del desembolso.",
                    "reintentos","Si el resultado es incierto, retomar la misma operación; no crear otra para repetir el pago.",
                    "limite","Proyecto académico con fondos de demostración. El asistente no puede ejecutar acciones."));
            case "mis_cuentas":{
                JsonNode data=get(config.getCuentasUrl(),"/api/cuentas/usuario/"+sesion.usuario(),sesion,deadline);
                fuente(fuentes,"Mis cuentas","/cuentas");var out=json.createObjectNode();out.put("totalCuentas",data.size());out.set("muestra",lista(data,6,this::cuenta));return out;
            }
            case "mis_movimientos":{
                JsonNode accounts=get(config.getCuentasUrl(),"/api/cuentas/usuario/"+sesion.usuario(),sesion,deadline);
                Map<Long,JsonNode> moves=new HashMap<>();int visited=0;
                for(JsonNode account:accounts){if(visited++>=3)break;for(JsonNode t:get(config.getTransaccionesUrl(),"/api/transacciones/cuenta/"+account.path("id").asLong(),sesion,deadline))moves.put(t.path("id").asLong(),t);}
                var sorted=moves.values().stream().sorted(Comparator.comparing((JsonNode t)->t.path("fechaTransaccion").asText()).reversed()).limit(8).toList();var out=json.createObjectNode();out.put("alcance","Hasta ocho movimientos de las primeras tres cuentas; no es un historial completo.");var a=out.putArray("movimientos");
                for(JsonNode t:sorted){a.add(movimiento(t));fuente(fuentes,"Movimiento #"+t.path("id").asLong(),"/transacciones/"+t.path("id").asLong());}return out;
            }
            case "mis_prestamos":{
                JsonNode data=get(config.getPrestamosUrl(),"/api/prestamos/usuario/"+sesion.usuario(),sesion,deadline);var rows=StreamSupport.stream(data.spliterator(),false).sorted(Comparator.comparing((JsonNode p)->p.path("fechaSolicitud").asText()).reversed()).limit(5).toList();
                var out=json.createObjectNode();out.put("totalPrestamos",data.size());var a=out.putArray("muestra");for(JsonNode p:rows){a.add(prestamo(p));fuente(fuentes,"Préstamo #"+p.path("id").asLong(),"/prestamos/"+p.path("id").asLong());}return out;
            }
            case "detalle_movimiento":{
                JsonNode d=get(config.getTransaccionesUrl(),"/api/transacciones/"+id+"/detalle",sesion,deadline);var out=json.createObjectNode();out.set("movimiento",movimiento(d.path("movimiento")));
                if(d.path("original").isObject())out.set("original",movimiento(d.path("original")));if(d.path("reversion").isObject())out.set("reversion",movimiento(d.path("reversion")));
                fuente(fuentes,"Movimiento #"+id,"/transacciones/"+id);return out;
            }
            case "detalle_prestamo":{
                JsonNode d=get(config.getPrestamosUrl(),"/api/prestamos/"+id+"/detalle",sesion,deadline);
                var out=campos(d,"totalPactado","totalPagado","saldoVencido","proximoVencimiento","importeProximaCuota","cuotasPagadas","cuotasVencidas");out.set("prestamo",prestamo(d.path("prestamo")));out.set("primerasCuotas",lista(d.path("cuotas"),6,c->campos(c,"numero","vencimiento","importe","pagado","pendiente","estado")));
                out.put("cronogramaHistoricoIncompleto",!d.path("advertencia").isNull() && d.hasNonNull("advertencia"));fuente(fuentes,"Préstamo #"+id,"/prestamos/"+id);return out;
            }
            case "resumen_operativo":{
                var out=json.createObjectNode();out.set("cuentas",campos(get(config.getCuentasUrl(),"/api/cuentas/metricas",sesion,deadline),"porEstado","saldoPen","saldoUsd"));out.set("prestamos",campos(get(config.getPrestamosUrl(),"/api/prestamos/metricas",sesion,deadline),"pendientesAtencion"));
                out.set("usuarios",json.valueToTree(Map.of("activos",usuarios.countByActivoTrue(),"inactivos",usuarios.countByActivoFalse())));out.put("nota","No se incluyen totales monetarios de préstamos que mezclen monedas. Los saldos de cuentas separan PEN/USD.");fuente(fuentes,"Resumen operativo","/dashboard");return out;
            }
            case "alertas_pendientes":{
                JsonNode d=get(config.getTransaccionesUrl(),"/api/alertas?estado=PENDIENTE&page=0&size=10&sort=fechaDeteccion,desc",sesion,deadline);var out=json.createObjectNode();out.set("totalPendientes",d.path("totalElements"));out.set("muestra",lista(d.path("content"),10,a->campos(a,"id","tipoAlerta","nivelRiesgo","estado","transaccionId","fechaDeteccion")));fuente(fuentes,"Alertas para revisar","/alertas");return out;
            }
            case "solicitudes_prestamo":{
                var out=json.createObjectNode();for(String estado:List.of("PENDIENTE","EN_REVISION")){
                    JsonNode d=get(config.getPrestamosUrl(),"/api/prestamos?estado="+estado+"&page=0&size=5&sort=fechaSolicitud,desc",sesion,deadline);var grupo=out.putObject(estado);grupo.set("total",d.path("totalElements"));grupo.set("muestra",lista(d.path("content"),5,this::prestamo));
                }fuente(fuentes,"Solicitudes de préstamo","/prestamos");return out;
            }
            default:throw new ResponseStatusException(HttpStatus.FORBIDDEN,"Herramienta no autorizada.");
        }
    }
    private JsonNode get(String base,String path,Sesion sesion,long deadline){return http.enviar(base+path,Map.of("Authorization",sesion.authorization()),null,deadline,false);}
    private ObjectNode campos(JsonNode n,String... keys){var o=json.createObjectNode();for(String key:keys)if(n.has(key))o.set(key,n.get(key));return o;}
    private JsonNode cuenta(JsonNode c){var o=campos(c,"id","tipoCuenta","saldo","moneda","estado");o.put("cuenta",IaPrivacidad.cuenta(c.path("numeroCuenta").asText()));return o;}
    private JsonNode movimiento(JsonNode t){var o=campos(t,"id","tipoTransaccion","monto","moneda","estado","fechaTransaccion","transaccionPadreId");o.put("origen",IaPrivacidad.cuenta(t.path("numeroCuentaOrigen").asText()));if(t.hasNonNull("numeroCuentaDestino"))o.put("destino",IaPrivacidad.cuenta(t.path("numeroCuentaDestino").asText()));return o;}
    private JsonNode prestamo(JsonNode p){return campos(p,"id","tipoPrestamo","montoSolicitado","saldoPendiente","cuotaMensual","tasaInteres","plazoMeses","moneda","estado","fechaSolicitud","fechaVencimiento");}
    private ArrayNode lista(JsonNode n,int max,java.util.function.Function<JsonNode,JsonNode> projection){var a=json.createArrayNode();if(n.isArray())for(JsonNode row:n){if(a.size()>=max)break;a.add(projection.apply(row));}return a;}
    private void fuente(Map<String,AsistenteResponse.Fuente> sources,String title,String path){sources.putIfAbsent(path,new AsistenteResponse.Fuente(title,path));}
}
