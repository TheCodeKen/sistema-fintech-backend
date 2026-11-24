import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, timeout } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { Transaccion, TransaccionDetalle, RevisionMovimiento } from '../models/models';
import { PageResponse } from '../models/models';

@Injectable({ providedIn: 'root' })
export class TransaccionService {

  private url = environment.msTransaccionesUrl;

  constructor(private http: HttpClient) {}

  getAll(): Observable<Transaccion[]> {
    return this.http.get<PageResponse<Transaccion>>(this.url).pipe(map(page => page.content));
  }

  getPage(page = 0, size = 10, tipo?: string, estado?: string, numeroCuenta?: string,
          desde?: string, hasta?: string): Observable<PageResponse<Transaccion>> {
    let params = new HttpParams().set('page', page).set('size', size).set('sort', 'fechaTransaccion,desc');
    if (tipo) params = params.set('tipo', tipo);
    if (estado) params = params.set('estado', estado);
    if (numeroCuenta?.trim()) params = params.set('numeroCuenta', numeroCuenta.trim());
    if (desde) params = params.set('desde', desde);
    if (hasta) params = params.set('hasta', hasta);
    return this.http.get<PageResponse<Transaccion>>(this.url, { params });
  }

  getById(id: number): Observable<Transaccion> {
    return this.http.get<Transaccion>(`${this.url}/${id}`);
  }

  getDetalle(id:number):Observable<TransaccionDetalle> {
    return this.http.get<TransaccionDetalle>(`${this.url}/${id}/detalle`);
  }

  revisar(movimiento:Transaccion):Observable<RevisionMovimiento> {
    return this.http.post<RevisionMovimiento>(`${this.url}/revisar`,movimiento).pipe(timeout(15000));
  }

  comprobante(id:number):Observable<Blob> {
    return this.http.get(`${this.url}/${id}/comprobante`,{responseType:'blob'});
  }

  getByCuenta(cuentaId: number): Observable<Transaccion[]> {
    return this.http.get<Transaccion[]>(`${this.url}/cuenta/${cuentaId}`);
  }

  create(transaccion: Transaccion, operacionId: string): Observable<Transaccion> {
    return this.http.post<Transaccion>(this.url, transaccion, { headers: { 'Idempotency-Key': operacionId } }).pipe(timeout(30000));
  }

  revertir(id: number): Observable<Transaccion> {
    return this.http.post<Transaccion>(`${this.url}/${id}/revertir`, {});
  }
}
