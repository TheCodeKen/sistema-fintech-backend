import { Injectable, signal } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { map, Observable, tap } from 'rxjs';
import { environment } from '../../environments/environment';
import { PageResponse } from '../models/models';

export interface Notificacion {
  id:number;tipo:string;titulo:string;mensaje:string;enlace:string;fechaEvento:string;leidaEn:string|null;
}

@Injectable({providedIn:'root'})
export class NotificacionService {
  private url=environment.msUsuariosUrl+'/notificaciones';
  readonly noLeidas=signal(0);
  constructor(private http:HttpClient){}
  reiniciar():void{this.noLeidas.set(0);}
  actualizarContador():Observable<number>{
    return this.http.get<{noLeidas:number}>(this.url+'/resumen').pipe(map(r=>r.noLeidas),tap(n=>this.noLeidas.set(n)));
  }
  listar(page=0,noLeidas=false):Observable<PageResponse<Notificacion>>{
    const params=new HttpParams().set('page',page).set('size',10).set('noLeidas',noLeidas);
    return this.http.get<PageResponse<Notificacion>>(this.url,{params});
  }
  leer(id:number):Observable<void>{return this.http.patch<void>(`${this.url}/${id}/leer`,{});}
  leerTodas(hastaId:number):Observable<void>{return this.http.patch<void>(this.url+'/leer-todas',{hastaId});}
}
