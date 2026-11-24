import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, timeout } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { PageResponse, Prestamo, PrestamoDetalle, EvaluacionCliente } from '../models/models';

@Injectable({ providedIn: 'root' })
export class PrestamoService {
  private url = environment.msPrestamosUrl;
  constructor(private http: HttpClient) {}

  getPage(page = 0, size = 10, estado?: string, usuarioId?: number, montoMin?: number, montoMax?: number): Observable<PageResponse<Prestamo>> {
    let params = new HttpParams().set('page', page).set('size', size);
    if (estado) params = params.set('estado', estado);
    if (usuarioId) params = params.set('usuarioId', usuarioId);
    if (montoMin != null) params = params.set('montoMin', montoMin);
    if (montoMax != null) params = params.set('montoMax', montoMax);
    return this.http.get<PageResponse<Prestamo>>(this.url, { params });
  }

  getAll(): Observable<Prestamo[]> {
    return this.getPage().pipe(map(page => page.content));
  }

  getById(id: number): Observable<Prestamo> { return this.http.get<Prestamo>(`${this.url}/${id}`); }
  getDetalle(id: number): Observable<PrestamoDetalle> { return this.http.get<PrestamoDetalle>(`${this.url}/${id}/detalle`); }
  getEvaluacion(id:number,pagina=0):Observable<EvaluacionCliente> {return this.http.get<EvaluacionCliente>(`${this.url}/${id}/evaluacion`,{params:{pagina}}).pipe(timeout(15000));}
  cancelar(id: number, motivo: string): Observable<Prestamo> { return this.http.post<Prestamo>(`${this.url}/${id}/cancelar`, { motivo }); }
  getByUsuario(usuarioId: number): Observable<Prestamo[]> { return this.http.get<Prestamo[]>(`${this.url}/usuario/${usuarioId}`); }
  create(prestamo: Prestamo, clave?: string): Observable<Prestamo> {
    return this.http.post<Prestamo>(this.url, prestamo, {headers: clave ? {'Idempotency-Key': clave} : {}}).pipe(timeout(30000));
  }
  revisar(id: number): Observable<Prestamo> { return this.http.patch<Prestamo>(`${this.url}/${id}/revisar`, null); }
  aprobar(id: number, observacion?: string): Observable<Prestamo> {
    return this.http.patch<Prestamo>(`${this.url}/${id}/aprobar`, observacion ? { observacion } : {});
  }
  rechazar(id: number, motivo: string): Observable<Prestamo> {
    return this.http.patch<Prestamo>(`${this.url}/${id}/rechazar`, { motivo });
  }
  desembolsar(id: number): Observable<Prestamo> { return this.http.post<Prestamo>(`${this.url}/${id}/desembolsar`, {}); }
  pagar(id: number, monto: number, cuentaId: number, operacionId: string): Observable<Prestamo> {
    return this.http.post<Prestamo>(`${this.url}/${id}/pagar`, { monto, cuentaId, operacionId });
  }
}
