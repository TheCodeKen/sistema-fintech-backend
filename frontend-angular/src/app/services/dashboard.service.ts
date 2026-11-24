import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { forkJoin, Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface DashboardMetricas {
  usuarios: { activos: number; inactivos: number; registradosHoy: number };
  cuentas: { porEstado: Record<string, number>; saldoPen: number; saldoUsd: number };
  transacciones: { montoHoy: number; cantidadHoy: number; porTipo: Record<string, number> };
  prestamos: { montoDesembolsado: number; pendientesAtencion: number };
}

@Injectable({ providedIn: 'root' })
export class DashboardService {
  constructor(private http: HttpClient) {}

  obtenerMetricas(): Observable<DashboardMetricas> {
    return forkJoin({
      usuarios: this.http.get<DashboardMetricas['usuarios']>(environment.msUsuariosMetricasUrl),
      cuentas: this.http.get<DashboardMetricas['cuentas']>(environment.msCuentasMetricasUrl),
      transacciones: this.http.get<DashboardMetricas['transacciones']>(environment.msTransaccionesMetricasUrl),
      prestamos: this.http.get<DashboardMetricas['prestamos']>(environment.msPrestamosMetricasUrl)
    });
  }
}
