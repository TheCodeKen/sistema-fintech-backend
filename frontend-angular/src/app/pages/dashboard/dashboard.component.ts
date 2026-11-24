import { Component, OnInit, OnDestroy } from '@angular/core';
import { forkJoin, of, Subscription, switchMap, timeout } from 'rxjs';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { UsuarioService } from '../../services/usuario.service';
import { CuentaService } from '../../services/cuenta.service';
import { TransaccionService } from '../../services/transaccion.service';
import { PrestamoService } from '../../services/prestamo.service';
import { AuthService } from '../../services/auth.service';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { DashboardService } from '../../services/dashboard.service';
import { AuditoriaService } from '../../services/auditoria.service';
import { Auditoria, Prestamo, Transaccion } from '../../models/models';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink, MatButtonModule, MatCardModule, MatIconModule],
  template: `
    <div class="page-container dashboard-shell">
      <mat-card class="welcome-banner">
        <div class="welcome-copy">
          <div class="welcome-pill">Banca digital</div>
          <h1>Bienvenido, {{ session?.nombre }}</h1>
          <p>Panel de control · FinTechPro</p>
        </div>
        <span class="badge" [class.badge-secondary]="isAdmin" [class.badge-info]="!isAdmin">
          {{ session?.rol }}
        </span>
      </mat-card>

      <!-- ───── VISTA ADMIN ───── -->
      <ng-container *ngIf="isAdmin">
        <p role="status" *ngIf="cargandoMetricas">Cargando el resumen…</p>
        <div role="alert" class="form-feedback" *ngIf="errorMetricas">{{errorMetricas}} <button mat-button (click)="cargarDatosAdmin()">Reintentar</button></div>
        <div class="kpi-grid" *ngIf="!cargandoMetricas && !errorMetricas">
          <mat-card class="kpi-card" routerLink="/usuarios">
            <div class="kpi-icon accent-blue"><mat-icon>group</mat-icon></div>
            <div class="kpi-info">
              <div class="kpi-value">{{ usuariosActivos }}</div>
              <div class="kpi-label">Usuarios activos ({{ usuariosInactivos }} inactivos)</div>
            </div>
          </mat-card>
          <mat-card class="kpi-card" routerLink="/cuentas">
            <div class="kpi-icon accent-violet"><mat-icon>account_balance</mat-icon></div>
            <div class="kpi-info">
              <div class="kpi-value">S/ {{ saldoPen | number:'1.2-2' }}</div>
              <div class="kpi-label">Custodia PEN · {{ cuentasActivas }} activas</div>
            </div>
          </mat-card>
          <mat-card class="kpi-card" routerLink="/transacciones">
            <div class="kpi-icon accent-emerald"><mat-icon>swap_horiz</mat-icon></div>
            <div class="kpi-info">
              <div class="kpi-value">{{ transaccionesHoy }}</div>
              <div class="kpi-label">Transacciones de hoy</div>
            </div>
          </mat-card>
          <mat-card class="kpi-card">
            <div class="kpi-icon accent-amber"><mat-icon>paid</mat-icon></div>
            <div class="kpi-info">
              <div class="kpi-value">{{ prestamosPendientes }}</div>
              <div class="kpi-label">Préstamos pendientes de atención</div>
            </div>
          </mat-card>
        </div>

        <div class="quick-section card">
          <h2>Acceso rápido</h2>
          <div class="quick-grid">
            <a routerLink="/usuarios" class="quick-item">
              <mat-icon>group</mat-icon>
              <div>
                <strong>Gestionar Usuarios</strong>
                <small>Administrar perfiles, permisos y acceso</small>
              </div>

            </a>
            <a routerLink="/cuentas" class="quick-item">
              <mat-icon>account_balance</mat-icon>
              <div>
                <strong>Gestionar Cuentas</strong>
                <small>Administrar cuentas bancarias y saldos</small>
              </div>
            </a>
            <a routerLink="/transacciones" class="quick-item">
              <mat-icon>swap_horiz</mat-icon>
              <div>
                <strong>Ver Transacciones</strong>
                <small>Depósitos, retiros y transferencias</small>
              </div>
            </a>
            <a routerLink="/prestamos" class="quick-item">
              <mat-icon>request_quote</mat-icon>
              <div>
                <strong>Gestionar Préstamos</strong>
                <small>Aprobar, rechazar y administrar préstamos</small>
              </div>
            </a>
            <a routerLink="/auditoria" class="quick-item">
              <mat-icon>fact_check</mat-icon>
              <div><strong>Consultar auditoría</strong><small>Revisar eventos sensibles y trazabilidad</small></div>
            </a>
          </div>
        </div>

        <div class="activity-grid">
          <div class="card">
            <h2>Últimas transacciones</h2>
            <p role="alert" *ngIf="errorTransacciones">No pudimos cargar los movimientos recientes. <button mat-button (click)="cargarDatosAdmin()">Reintentar</button></p>
            <div *ngFor="let tx of transaccionesRecientes" class="activity-row">
              <span>{{ tx.tipoTransaccion }}</span><strong>{{ tx.monto | number:'1.2-2' }} {{ tx.moneda }}</strong>
            </div>
            <a routerLink="/transacciones">Ver historial completo</a>
          </div>
          <div class="card">
            <h2>Últimos eventos de auditoría</h2>
            <p role="alert" *ngIf="errorAuditoria">No pudimos cargar la auditoría reciente. <button mat-button (click)="cargarDatosAdmin()">Reintentar</button></p>
            <div *ngFor="let evento of auditoriasRecientes" class="activity-row">
              <span>{{ evento.accion }}</span><small>{{ evento.entidadAfectada }}</small>
            </div>
            <a routerLink="/auditoria">Ver log completo</a>
          </div>
        </div>

        <div class="card" style="margin-top:20px">
          <h2 style="margin-bottom:16px;font-size:16px;color:#2563eb">Disponibilidad de servicios</h2>
          <div class="ms-grid">
            <div class="ms-card" *ngFor="let ms of microservicios">
              <div class="ms-dot" [class]="ms.ok===true ? 'dot-ok' : ms.ok===false ? 'dot-err' : 'dot-pending'"></div>
              <div>
                <strong>{{ ms.nombre }}</strong>
                <small>{{ ms.puerto }}</small>
              </div>
              <span class="badge" [class]="ms.ok===true ? 'badge-success' : ms.ok===false ? 'badge-danger' : 'badge-secondary'">
                {{ ms.ok===true ? 'Disponible' : ms.ok===false ? 'Consulta no disponible' : 'Sin verificar' }}
              </span>
            </div>
          </div>
        </div>
      </ng-container>

      <!-- ───── VISTA CLIENTE ───── -->
      <ng-container *ngIf="!isAdmin">
        <p role="status" *ngIf="cargandoCliente">Cargando tus cuentas y movimientos…</p>
        <div role="alert" class="form-feedback" *ngIf="errorCliente">{{errorCliente}} <button mat-button (click)="cargarDatosCliente()">Reintentar</button></div>
        <div class="kpi-grid" *ngIf="!cargandoCliente && !errorCliente">
          <mat-card class="kpi-card" routerLink="/cuentas">
            <div class="kpi-icon accent-violet"><mat-icon>account_balance</mat-icon></div>
            <div class="kpi-info">
              <div class="kpi-value">{{ misCuentas }}</div>
              <div class="kpi-label">Mis cuentas</div>
            </div>
          </mat-card>
          <mat-card class="kpi-card">
            <div class="kpi-icon accent-emerald"><mat-icon>payments</mat-icon></div>
            <div class="kpi-info">
              <div class="kpi-value">S/ {{ miSaldo | number:'1.2-2' }}</div>
              <div class="kpi-label">Cuentas activas · USD {{miSaldoUsd | number:'1.2-2'}}</div>
            </div>
          </mat-card>
          <mat-card class="kpi-card" routerLink="/transacciones">
            <div class="kpi-icon accent-blue"><mat-icon>swap_horiz</mat-icon></div>
            <div class="kpi-info">
              <div class="kpi-value">{{ misTransacciones }}</div>
              <div class="kpi-label">Mis transacciones</div>
            </div>
          </mat-card>
          <mat-card class="kpi-card" routerLink="/prestamos">
            <div class="kpi-icon accent-amber"><mat-icon>request_quote</mat-icon></div>
            <div class="kpi-info">
              <div class="kpi-value">{{ misPrestamos }}</div>
              <div class="kpi-label">Mis préstamos</div>
            </div>
          </mat-card>
        </div>

        <div class="quick-section card">
          <h2>¿Qué deseas hacer?</h2>
          <div class="quick-grid">
            <a routerLink="/cuentas" class="quick-item">
              <mat-icon>account_balance</mat-icon>
              <div>
                <strong>Ver mis cuentas</strong>
                <small>Consulta tus cuentas y saldos disponibles</small>
              </div>
            </a>
            <a routerLink="/transacciones" class="quick-item">
              <mat-icon>swap_horiz</mat-icon>
              <div>
                <strong>Realizar una transacción</strong>
                <small>Depósitos, retiros y transferencias</small>
              </div>
            </a>
            <a routerLink="/prestamos" class="quick-item">
              <mat-icon>request_quote</mat-icon>
              <div>
                <strong>Solicitar un préstamo</strong>
                <small>Revisa tus préstamos o solicita uno nuevo</small>
              </div>
            </a>
          </div>
        </div>
      </ng-container>
              <div class="card" *ngIf="!isAdmin && !cargandoCliente && !errorCliente && misPrestamosDetalle.length">
                <h2>Estado de mis préstamos</h2>
                <div *ngFor="let prestamo of misPrestamosDetalle" class="activity-row">
                  <span>{{ prestamo.numeroPrestamo || ('Préstamo #' + prestamo.id) }}</span>
                  <strong>{{ prestamo.estado }}</strong>
                </div>
              </div>
    </div>
  `,
  styles: [`
    :host { display: block; }

    .dashboard-shell { display: grid; gap: 18px; }

    .welcome-banner {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 18px;
      border-radius: 22px;
      padding: 28px 30px;
      background: linear-gradient(135deg, #ffffff 0%, #eff6ff 100%);
      box-shadow: 0 14px 36px rgba(15, 23, 42, .08);
      border: 1px solid rgba(37, 99, 235, .08);
    }

    .welcome-pill {
      display: inline-flex;
      padding: 7px 12px;
      border-radius: 999px;
      background: #e8f1ff;
      color: #1d4ed8;
      font-size: 12px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: .4px;
      margin-bottom: 12px;
    }

    .welcome-banner h1 { margin: 0; font-size: 28px; font-weight: 800; color: #0f172a; }
    .welcome-banner p { margin: 6px 0 0; color: #64748b; }

    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 16px;
    }

    .kpi-card {
      display: flex;
      align-items: center;
      gap: 16px;
      padding: 20px;
      cursor: pointer;
      border-radius: 18px;
      box-shadow: 0 10px 30px rgba(15, 23, 42, .08);
      border: 1px solid rgba(37, 99, 235, .08);
      transition: transform .15s ease, box-shadow .15s ease;
    }

    .kpi-card:hover { transform: translateY(-2px); box-shadow: 0 16px 36px rgba(15, 23, 42, .10); }
    .kpi-icon {
      width: 56px; height: 56px; border-radius: 16px; display: grid; place-items: center;
      flex-shrink: 0; color: #fff;
    }
    .kpi-icon mat-icon { width: 26px; height: 26px; font-size: 26px; }
    .accent-blue { background: linear-gradient(135deg, #2563eb, #1d4ed8); }
    .accent-violet { background: linear-gradient(135deg, #4f46e5, #7c3aed); }
    .accent-emerald { background: linear-gradient(135deg, #059669, #10b981); }
    .accent-amber { background: linear-gradient(135deg, #d97706, #f59e0b); }
    .kpi-value { font-size: 26px; font-weight: 800; color: #0f172a; line-height: 1.1; }
    .kpi-label { font-size: 12px; color: #64748b; margin-top: 2px; }

    .quick-section h2 { font-size: 16px; font-weight: 700; margin-bottom: 16px; color: #0f172a; }

    .quick-grid { display: grid; gap: 10px; }
    .quick-item {
      display: flex; align-items: center; gap: 14px; padding: 14px 16px;
      background: #f8fafc; border-radius: 14px; text-decoration: none; color: inherit;
      transition: background .15s ease, transform .15s ease;
    }
    .quick-item:hover { background: #eef4ff; transform: translateX(2px); }
    .quick-item mat-icon { color: #2563eb; }
    .quick-item strong { display: block; font-size: 14px; color: #0f172a; }
    .quick-item small { color: #64748b; font-size: 12px; }

    .ms-grid { display: grid; gap: 10px; }
    .ms-card { display: flex; align-items: center; gap: 12px; padding: 12px 16px; background: #f8fafc; border-radius: 12px; }
    .ms-card strong { display: block; font-size: 13px; }
    .ms-card small { color: #64748b; font-size: 12px; }
    .ms-card .badge { margin-left: auto; }
    .ms-dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }
    .dot-ok  { background: #16a34a; box-shadow: 0 0 0 3px #dcfce7; }
    .dot-err { background: #dc2626; box-shadow: 0 0 0 3px #fee2e2; }
    .dot-pending { background: #94a3b8; }
    .activity-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 18px; }
    .activity-row { display: flex; justify-content: space-between; gap: 12px; padding: 10px 0; border-bottom: 1px solid #e2e8f0; font-size: 13px; }
    .activity-row small { color: #64748b; }
    .card h2 { font-size: 16px; margin: 0 0 10px; color: #2563eb; }
    @media (max-width: 700px) { .activity-grid { grid-template-columns: 1fr; } }

    @media (max-width: 900px) {
      .welcome-banner { align-items: flex-start; flex-direction: column; }
    }
  `]
})
export class DashboardComponent implements OnInit, OnDestroy {
  cargandoMetricas=true;errorMetricas='';errorTransacciones=false;errorAuditoria=false;
  cargandoCliente=true;errorCliente='';
  private consultas=new Subscription();
  session = this.auth.getSession();
  get isAdmin(): boolean { return this.session?.rol === 'ADMIN'; }

  // Admin stats
  totalUsuarios = 0;
  totalCuentas = 0;
  totalTransacciones = 0;
  totalSaldo = 0;
  usuariosActivos = 0;
  usuariosInactivos = 0;
  saldoPen = 0;
  saldoUsd = 0;
  cuentasActivas = 0;
  transaccionesHoy = 0;
  montoTransaccionesHoy = 0;
  prestamosPendientes = 0;
  transaccionesRecientes: Transaccion[] = [];
  auditoriasRecientes: Auditoria[] = [];

  // Cliente stats
  misCuentas = 0;
  miSaldo = 0;
  miSaldoUsd = 0;
  private movimientosCliente = new Set<number>();
  misTransacciones = 0;
  misPrestamos = 0;
  misPrestamosDetalle: Prestamo[] = [];

  microservicios = [
    { nombre: 'Usuarios',      puerto: 'Acceso y perfiles', ok: null as boolean|null },
    { nombre: 'Cuentas',       puerto: 'Cuentas y saldos', ok: null as boolean|null },
    { nombre: 'Movimientos', puerto: 'Transferencias y pagos', ok: null as boolean|null },
    { nombre: 'Préstamos', puerto: 'Solicitudes y cuotas', ok: null as boolean|null },
    { nombre: 'Auditoría', puerto: 'Historial de operaciones', ok: null as boolean|null }
  ];

  constructor(
    private auth: AuthService,
    private usuarioSvc: UsuarioService,
    private cuentaSvc: CuentaService,
    private transaccionSvc: TransaccionService,
    private prestamoSvc: PrestamoService,
    private dashboardSvc: DashboardService,
    private auditoriaSvc: AuditoriaService
  ) {}

  ngOnInit(): void {
    this.isAdmin ? this.cargarDatosAdmin() : this.cargarDatosCliente();
  }

  cargarDatosAdmin(): void {
    this.consultas.unsubscribe();this.consultas=new Subscription();
    this.cargandoMetricas=true;this.errorMetricas='';this.errorTransacciones=false;this.errorAuditoria=false;
    this.transaccionesRecientes=[];this.auditoriasRecientes=[];this.microservicios.forEach(ms=>ms.ok=null);
    this.consultas.add(this.dashboardSvc.obtenerMetricas().pipe(timeout(15000)).subscribe({
      next: (m) => {
        this.usuariosActivos = m.usuarios.activos; this.usuariosInactivos = m.usuarios.inactivos;
        this.saldoPen = m.cuentas.saldoPen; this.saldoUsd = m.cuentas.saldoUsd;
        this.cuentasActivas = m.cuentas.porEstado['ACTIVA'] || 0;
        this.transaccionesHoy = m.transacciones.cantidadHoy; this.montoTransaccionesHoy = m.transacciones.montoHoy;
        this.prestamosPendientes = m.prestamos.pendientesAtencion;
        this.microservicios.slice(0,4).forEach(ms => ms.ok = true);this.cargandoMetricas=false;
      },
      error: () => {this.cargandoMetricas=false;this.errorMetricas='No pudimos cargar el resumen. Los importes y contadores están pendientes de verificar.';}
    }));
    this.consultas.add(this.transaccionSvc.getPage(0, 5).pipe(timeout(15000)).subscribe({
      next: (page) => { this.transaccionesRecientes = page.content; this.microservicios[2].ok = true; },
      error: () => {this.errorTransacciones=true;}
    }));
    this.consultas.add(this.auditoriaSvc.getPage(0, 5).pipe(timeout(15000)).subscribe({
      next: (page) => { this.auditoriasRecientes = page.content;this.microservicios[4].ok=true; },
      error: () => {this.errorAuditoria=true;this.microservicios[4].ok=false;}
    }));
  }

  cargarDatosCliente(): void {
    this.consultas.unsubscribe();this.consultas=new Subscription();this.cargandoCliente=true;this.errorCliente='';
    const uid = this.session!.usuarioId;
    this.consultas.add(forkJoin({cuentas:this.cuentaSvc.getByUsuario(uid),prestamos:this.prestamoSvc.getByUsuario(uid)}).pipe(
      switchMap(datos=>{
        const movimientos=datos.cuentas.length ? forkJoin(datos.cuentas.map(c=>this.transaccionSvc.getByCuenta(c.id!))) : of([] as Transaccion[][]);
        return forkJoin({datos:of(datos),movimientos});
      }),timeout(15000)
    ).subscribe({next:({datos,movimientos})=>{
        const c=datos.cuentas;
        const activas = c.filter(cuenta => cuenta.estado === 'ACTIVA');
        this.misCuentas = c.length;
        this.miSaldo = activas.filter(cu => cu.moneda === 'PEN').reduce((s, cu) => s + (cu.saldo || 0), 0);
        this.miSaldoUsd = activas.filter(cu => cu.moneda === 'USD').reduce((s, cu) => s + (cu.saldo || 0), 0);
        this.movimientosCliente.clear();
        movimientos.flat().forEach(tx=>this.movimientosCliente.add(tx.id!));this.misTransacciones=this.movimientosCliente.size;
        this.misPrestamos=datos.prestamos.length;this.misPrestamosDetalle=datos.prestamos;this.cargandoCliente=false;
      },error:()=>{this.cargandoCliente=false;this.errorCliente='No pudimos completar tu resumen. Reintenta para consultar tus saldos y movimientos.';}
    }));
  }
  ngOnDestroy():void {this.consultas.unsubscribe();}
}
