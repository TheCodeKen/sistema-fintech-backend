import { Injectable } from '@angular/core';
import { AuthService } from './auth.service';
import { Prestamo } from '../models/models';

export interface SolicitudPendiente { clave: string; prestamo: Prestamo; }

@Injectable({providedIn: 'root'})
export class SolicitudPendienteService {
  constructor(private auth: AuthService) {}
  private get key(): string { return `fintech_solicitud_${this.auth.getSession()?.usuarioId}`; }
  leer(): SolicitudPendiente | null {
    try {
      const raw = sessionStorage.getItem(this.key);
      if (!raw) return null;
      const pendiente = JSON.parse(raw) as SolicitudPendiente;
      return /^[A-Za-z0-9_-]{8,64}$/.test(pendiente.clave) && pendiente.prestamo?.usuarioId > 0
        ? pendiente : null;
    } catch { return null; }
  }
  guardar(clave: string, prestamo: Prestamo): void {
    sessionStorage.setItem(this.key, JSON.stringify({clave, prestamo}));
  }
  limpiar(): void { sessionStorage.removeItem(this.key); }
}
