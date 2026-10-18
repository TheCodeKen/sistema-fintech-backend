import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { environment } from '../../environments/environment';
import { LoginRequest, LoginResponse, RegistroRequest } from '../models/models';

@Injectable({ providedIn: 'root' })
export class AuthService {

  private readonly AUTH_KEY = 'fintech_user';
  private readonly TOKEN_KEY = 'fintech_token';

  constructor(private http: HttpClient) {}

  login(credentials: LoginRequest): Observable<LoginResponse> {
    return this.http
      .post<LoginResponse>(`${environment.msUsuariosUrl}/login`, credentials)
      .pipe(tap(resp => {
        if (resp.autenticado) {
          sessionStorage.setItem(this.AUTH_KEY, JSON.stringify(resp));
          sessionStorage.setItem(this.TOKEN_KEY, resp.token);
        }
      }));
  }

  register(data: RegistroRequest): Observable<LoginResponse> {
    return this.http
      .post<LoginResponse>(`${environment.msUsuariosUrl}/registro`, data)
      .pipe(tap(resp => {
        if (resp.autenticado) {
          sessionStorage.setItem(this.AUTH_KEY, JSON.stringify(resp));
          sessionStorage.setItem(this.TOKEN_KEY, resp.token);
        }
      }));
  }

  logout(): void {
    sessionStorage.removeItem(this.AUTH_KEY);
    sessionStorage.removeItem(this.TOKEN_KEY);
  }

  getSession(): LoginResponse | null {
    const data = sessionStorage.getItem(this.AUTH_KEY);
    return data ? JSON.parse(data) : null;
  }

  getToken(): string | null {
    return sessionStorage.getItem(this.TOKEN_KEY);
  }

  isLoggedIn(): boolean {
    return !!this.getSession();
  }
}
