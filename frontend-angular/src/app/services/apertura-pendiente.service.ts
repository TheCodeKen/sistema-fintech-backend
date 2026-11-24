import { Injectable } from '@angular/core';
import { AuthService } from './auth.service';
import { Cuenta } from '../models/models';

export interface AperturaPendiente { clave: string; cuenta: Cuenta; }

@Injectable({providedIn: 'root'})
export class AperturaPendienteService {
  constructor(private auth: AuthService) {}
  private get key(): string { return `fintech_apertura_${this.auth.getSession()?.usuarioId}`; }
  leer(): AperturaPendiente | null {
    try {
      const raw = sessionStorage.getItem(this.key);
      if (!raw) return null;
      const pendiente = JSON.parse(raw) as AperturaPendiente;
      return /^[A-Za-z0-9_-]{8,64}$/.test(pendiente.clave) && pendiente.cuenta?.usuarioId > 0
        ? pendiente : null;
    } catch { return null; }
  }
  guardar(clave: string, cuenta: Cuenta): void {
    sessionStorage.setItem(this.key, JSON.stringify({clave, cuenta}));
  }
  limpiar(): void { sessionStorage.removeItem(this.key); }
}
