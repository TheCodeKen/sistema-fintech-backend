import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { Auditoria, PageResponse } from '../models/models';

@Injectable({ providedIn: 'root' })
export class AuditoriaService {
  private readonly url = environment.msAuditoriaUrl;
  constructor(private http: HttpClient) {}

  getPage(page = 0, size = 20, accion?: string, entidadAfectada?: string,
          usuarioEjecutor?: string, desde?: string, hasta?: string): Observable<PageResponse<Auditoria>> {
    let params = new HttpParams().set('page', page).set('size', size);
    if (accion) params = params.set('accion', accion);
    if (entidadAfectada) params = params.set('entidadAfectada', entidadAfectada);
    if (usuarioEjecutor?.trim()) params = params.set('usuarioEjecutor', usuarioEjecutor.trim());
    if (desde) params = params.set('desde', desde);
    if (hasta) params = params.set('hasta', hasta);
    return this.http.get<PageResponse<Auditoria>>(this.url, { params });
  }
}
