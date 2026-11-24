import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { PageResponse, Usuario } from '../models/models';

@Injectable({ providedIn: 'root' })
export class UsuarioService {

  private url = environment.msUsuariosUrl;

  constructor(private http: HttpClient) {}

  getAll(): Observable<Usuario[]> {
    return this.http.get<PageResponse<Usuario>>(this.url).pipe(map(page => page.content));
  }

  getPage(page = 0, size = 10, rol?: string, estado?: boolean, busqueda?: string): Observable<PageResponse<Usuario>> {
    let params = new HttpParams().set('page', page).set('size', size);
    if (rol) params = params.set('rol', rol);
    if (estado !== undefined) params = params.set('estado', estado);
    if (busqueda?.trim()) params = params.set('busqueda', busqueda.trim());
    return this.http.get<PageResponse<Usuario>>(this.url, { params });
  }

  getById(id: number): Observable<Usuario> {
    return this.http.get<Usuario>(`${this.url}/${id}`);
  }

  create(usuario: Usuario): Observable<Usuario> {
    return this.http.post<Usuario>(this.url, usuario);
  }

  update(id: number, usuario: Usuario): Observable<Usuario> {
    return this.http.put<Usuario>(`${this.url}/${id}`, usuario);
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.url}/${id}`);
  }

  cambiarEstado(id: number, activo: boolean): Observable<Usuario> {
    return this.http.patch<Usuario>(`${this.url}/${id}/estado`, null, { params: { activo } });
  }
}
