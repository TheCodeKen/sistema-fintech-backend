import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { Alerta, PageResponse } from '../models/models';

@Injectable({ providedIn: 'root' })
export class AlertaService {
  private readonly url = environment.msTransaccionesUrl.replace('/api/transacciones', '/api/alertas');
  constructor(private http: HttpClient) {}

  getPage(page = 0, size = 20, nivelRiesgo?: string, estado?: string, tipoAlerta?: string): Observable<PageResponse<Alerta>> {
    let params = new HttpParams().set('page', page).set('size', size);
    if (nivelRiesgo) params = params.set('nivelRiesgo', nivelRiesgo);
    if (estado) params = params.set('estado', estado);
    if (tipoAlerta) params = params.set('tipoAlerta', tipoAlerta);
    return this.http.get<PageResponse<Alerta>>(this.url, { params });
  }

  countPendientes(): Observable<number> {
    return this.http.get<number>(`${this.url}/pendientes/count`);
  }

  resolver(id: number, estado: 'RESUELTA' | 'DESCARTADA', observacion: string): Observable<Alerta> {
    return this.http.patch<Alerta>(`${this.url}/${id}/resolver`, { estado, observacion });
  }

  bloquearCuenta(id: number, observacion: string): Observable<Alerta> {
    return this.http.post<Alerta>(`${this.url}/${id}/bloquear-cuenta`, null, { params: { observacion } });
  }
}
