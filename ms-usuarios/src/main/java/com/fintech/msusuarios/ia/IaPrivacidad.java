package com.fintech.msusuarios.ia;

public final class IaPrivacidad {
    private IaPrivacidad(){}
    public static String texto(String input){
        return input.replaceAll("(?i)Bearer\\s+[A-Za-z0-9_.-]+","[credencial omitida]")
                .replaceAll("eyJ[A-Za-z0-9_-]+\\.[A-Za-z0-9_-]+\\.[A-Za-z0-9_-]+","[token omitido]")
                .replaceAll("sk-[A-Za-z0-9_-]{10,}","[clave omitida]")
                .replaceAll("[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}","[correo omitido]")
                .replaceAll("(?i)FT(\\d{4})(\\d{4})","cuenta ****$2")
                .replaceAll("(?i)(contraseña|password|token|api[_ -]?key)\\s*[:=]\\s*\\S+","$1: [dato omitido]");
    }
    public static String cuenta(String value){return value!=null && value.length()>=4 ? "****"+value.substring(value.length()-4) : "No disponible";}
}
