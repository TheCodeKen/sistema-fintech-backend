import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, timeout } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { Cuenta, PageResponse } from '../models/models';

@Injectable({ providedIn: 'root' })
export class CuentaService {

  private url = environment.msCuentasUrl;

  constructor(private http: HttpClient) {}

  getAll(): Observable<Cuenta[]> {
    return this.http.get<PageResponse<Cuenta>>(this.url).pipe(map(page => page.content));
  }

  getPage(page = 0, size = 10, moneda?: string, estado?: string, numeroCuenta?: string): Observable<PageResponse<Cuenta>> {
    let params = new HttpParams().set('page', page).set('size', size);
    if (moneda) params = params.set('moneda', moneda);
    if (estado) params = params.set('estado', estado);
    if (numeroCuenta?.trim()) params = params.set('numeroCuenta', numeroCuenta.trim());
    return this.http.get<PageResponse<Cuenta>>(this.url, { params });
  }

  getById(id: number): Observable<Cuenta> {
    return this.http.get<Cuenta>(`${this.url}/${id}`);
  }

  getByUsuario(usuarioId: number): Observable<Cuenta[]> {
    return this.http.get<Cuenta[]>(`${this.url}/usuario/${usuarioId}`);
  }

  create(cuenta: Cuenta, clave?:string): Observable<Cuenta> {
    return this.http.post<Cuenta>(this.url, cuenta, {headers:clave ? {'Idempotency-Key':clave} : {}}).pipe(timeout(30000));
  }

  activar(id: number): Observable<Cuenta> {
    return this.http.patch<Cuenta>(`${this.url}/${id}/activar`, null);
  }

  bloquear(id: number, motivo: string): Observable<Cuenta> {
    return this.http.patch<Cuenta>(`${this.url}/${id}/bloquear`, null, { params: { motivo } });
  }

  congelar(id: number, motivo: string): Observable<Cuenta> {
    return this.http.patch<Cuenta>(`${this.url}/${id}/congelar`, null, { params: { motivo } });
  }

  desbloquear(id: number): Observable<Cuenta> {
    return this.http.patch<Cuenta>(`${this.url}/${id}/desbloquear`, null);
  }

  cerrar(id: number): Observable<Cuenta> {
    return this.http.patch<Cuenta>(`${this.url}/${id}/cerrar`, null);
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.url}/${id}`);
  }
}
