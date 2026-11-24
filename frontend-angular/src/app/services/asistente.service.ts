import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, timeout } from 'rxjs';
import { environment } from '../../environments/environment';

export type ModoAsistente='CLIENTE'|'ADMIN';
export interface TurnoAsistente {rol:'USER'|'ASSISTANT';texto:string;}
export interface SolicitudAsistente {mensaje:string;modo:ModoAsistente;consultarDatos:boolean;historial:TurnoAsistente[];}
export interface RespuestaAsistente {respuesta:string;modo:ModoAsistente;fuentes:{titulo:string;enlace:string}[];datosConsultados:boolean;}
export interface EstadoAsistente {disponible:boolean;proveedor:string;administrador:boolean;procesamientoLocal?:boolean;}

@Injectable({providedIn:'root'})
export class AsistenteService {
  private url=environment.msUsuariosUrl+'/asistente';
  constructor(private http:HttpClient){}
  estado():Observable<EstadoAsistente>{return this.http.get<EstadoAsistente>(this.url+'/estado');}
  conversar(request:SolicitudAsistente):Observable<RespuestaAsistente>{return this.http.post<RespuestaAsistente>(this.url+'/chat',request).pipe(timeout(65000));}
}
