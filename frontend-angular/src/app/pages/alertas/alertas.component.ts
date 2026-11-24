import { Component, OnInit, OnDestroy, TemplateRef, ViewChild } from '@angular/core';
import { Subscription, timeout } from 'rxjs';
import { MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AlertaService } from '../../services/alerta.service';
import { Alerta } from '../../models/models';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatInputModule } from '@angular/material/input';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';

@Component({
  selector: 'app-alertas',
  standalone: true,
  imports: [CommonModule, FormsModule, DatePipe, MatButtonModule, MatCardModule, MatFormFieldModule,
    MatIconModule, MatSelectModule, MatInputModule, MatSnackBarModule, MatDialogModule],
  template: `
    <div class="page">
      <mat-card class="hero"><div><span class="eyebrow">Control antifraude</span><h1>Alertas de seguridad</h1>
        <p>Revisa patrones de riesgo detectados automáticamente durante las operaciones.</p></div><mat-icon>security</mat-icon></mat-card>
      <section class="filter-shell" aria-label="Filtros de alertas">
        <form (ngSubmit)="aplicarFiltros()">
          <div class="filter-line"><label class="filter-primary-select">Estado de las alertas<select aria-label="Estado de las alertas" [(ngModel)]="estado" name="estado"><option value="">Todos los estados</option><option *ngFor="let e of estados" [value]="e">{{e.replaceAll('_',' ')}}</option></select></label>
            <button class="filter-toggle" type="button" (click)="masFiltros=!masFiltros" [attr.aria-expanded]="masFiltros" aria-controls="advanced-alertas"><mat-icon>tune</mat-icon>Más filtros<span class="filter-count" *ngIf="filtrosActivos">{{filtrosActivos}}</span></button>
            <button class="filter-apply" type="submit">Buscar</button>
            <button class="filter-clear" type="button" *ngIf="filtrosActivos" (click)="limpiarFiltros()">Limpiar</button>
          </div>
          <div class="filter-details" id="advanced-alertas" *ngIf="masFiltros"><label>Riesgo<select [(ngModel)]="nivel" name="nivel"><option value="">Todos los niveles</option><option *ngFor="let n of niveles" [value]="n">{{n}}</option></select></label><label>Tipo de alerta<select [(ngModel)]="tipo" name="tipo"><option value="">Todos los tipos</option><option *ngFor="let t of tipos" [value]="t">{{t.replaceAll('_',' ')}}</option></select></label></div>
          <p class="filter-validation" role="alert" *ngIf="filtroError">{{filtroError}}</p>
        </form>
      </section>
      <mat-card class="table-card">
        <div class="heading"><div><h2>Alertas detectadas</h2><p *ngIf="!loading && !errorCarga">{{ total }} registros</p></div></div>
        <p role="status" *ngIf="loading">Cargando alertas…</p>
        <div role="alert" class="form-feedback" *ngIf="errorCarga">{{errorCarga}} <button mat-button (click)="cargar()">Reintentar</button></div>
        <div class="table-wrap"><table><thead><tr><th>Fecha</th><th>Riesgo</th><th>Tipo</th><th>Cuenta</th><th>Descripción</th><th>Estado</th><th>Acciones</th></tr></thead>
          <tbody><tr *ngFor="let a of alertas"><td>{{ a.fechaDeteccion | date:'dd/MM/yyyy HH:mm' }}</td><td><span class="risk" [class]="riesgoClase(a.nivelRiesgo)">{{ a.nivelRiesgo }}</span></td><td>{{ a.tipoAlerta }}</td><td>{{ a.numeroCuenta }}</td><td>{{ a.descripcion }}</td><td>{{ a.estado }}</td><td class="actions" *ngIf="a.estado === 'PENDIENTE' || a.estado === 'EN_REVISION'"><button mat-button color="primary" (click)="resolver(a, 'RESUELTA')">Resolver</button><button mat-button (click)="resolver(a, 'DESCARTADA')">Descartar</button><button mat-button color="warn" (click)="bloquear(a)">Bloquear cuenta</button></td><td *ngIf="a.estado !== 'PENDIENTE' && a.estado !== 'EN_REVISION'">—</td></tr></tbody>
        </table><div class="empty" *ngIf="!loading && !errorCarga && !alertas.length">No hay alertas para los filtros seleccionados.</div></div>
        <div class="pager" *ngIf="!errorCarga"><button mat-button (click)="cambiarPagina(-1)" [disabled]="loading || pagina === 0">Anterior</button><span>Página {{ pagina + 1 }} de {{ totalPaginas || 1 }}</span><button mat-button (click)="cambiarPagina(1)" [disabled]="loading || pagina + 1 >= totalPaginas">Siguiente</button></div>
      </mat-card>
    </div>
    <ng-template #decisionDialog>
      <form (ngSubmit)="confirmarAccion()">
        <h2 mat-dialog-title>{{ tituloAccion }}</h2>
        <mat-dialog-content>
        <p *ngIf="alertaSeleccionada">{{ alertaSeleccionada.tipoAlerta }} · {{ alertaSeleccionada.numeroCuenta }}</p>
        <p class="form-intro">{{ descripcionAccion }}</p>
        <div role="alert" class="form-feedback" *ngIf="errorAccion">{{errorAccion}}</div>
        <mat-form-field appearance="outline" class="modal-field"><mat-label>Motivo de la decisión</mat-label><textarea matInput name="observacion" rows="4" [(ngModel)]="observacion" maxlength="1000" required [disabled]="guardando"></textarea><mat-hint>Obligatorio. Hasta 1000 caracteres.</mat-hint></mat-form-field>
        </mat-dialog-content>
        <mat-dialog-actions align="end"><button mat-button type="button" (click)="cerrarModal()" [disabled]="guardando">Cancelar</button><button mat-raised-button color="primary" type="submit" [disabled]="guardando || !observacion.trim() || observacion.length>1000">{{guardando ? 'Guardando…' : tituloAccion}}</button></mat-dialog-actions>
      </form>
    </ng-template>
  `,
  styles: [`.page{display:grid;gap:18px}.hero,.filters,.table-card{border-radius:20px;border:1px solid #e2e8f0}.hero{display:flex;justify-content:space-between;align-items:center;background:linear-gradient(135deg,#fff,#fff1f2)}.hero h1{margin:4px 0;font-size:28px}.hero p{color:#64748b}.hero mat-icon{font-size:48px;width:48px;height:48px;color:#dc2626}.eyebrow{color:#dc2626;font-size:12px;font-weight:700;text-transform:uppercase}.filters{display:flex;gap:12px;align-items:center;flex-wrap:wrap;padding:18px}.filters mat-form-field{min-width:170px}.table-card{padding:20px}.heading h2{margin:0}.heading p{color:#64748b}.table-wrap{overflow:auto;border:1px solid #e2e8f0;border-radius:14px}.table-wrap table{width:100%;min-width:1100px;border-collapse:collapse}.table-wrap th,.table-wrap td{padding:12px;text-align:left;border-bottom:1px solid #e2e8f0;font-size:13px}.table-wrap th{background:#f8fafc;color:#64748b}.risk{border-radius:999px;padding:5px 9px;font-weight:700;font-size:11px}.risk-bajo{background:#dbeafe;color:#1d4ed8}.risk-medio{background:#fef3c7;color:#92400e}.risk-alto,.risk-critico{background:#fee2e2;color:#b91c1c}.actions{white-space:nowrap}.empty{text-align:center;padding:30px}.pager{display:flex;justify-content:center;align-items:center;gap:18px;padding-top:14px}.modal-backdrop{position:fixed;inset:0;background:#0f172a99;display:grid;place-items:center;z-index:1000}.modal{background:#fff;border-radius:16px;padding:24px;width:min(480px,calc(100vw - 32px));box-shadow:0 20px 50px #0f172a55}.modal h2{margin-top:0}.modal-field{width:100%}.modal-actions{display:flex;justify-content:flex-end;gap:10px}`]
})
export class AlertasComponent implements OnInit, OnDestroy {
  loading = false; errorCarga = ''; guardando = false; errorAccion = '';
  private consulta?: Subscription;
  private decision?: Subscription;
  private dialogRef?: MatDialogRef<unknown>;
  @ViewChild('decisionDialog') decisionDialog!: TemplateRef<unknown>;
  get tituloAccion(): string { return this.alertaAccion === 'BLOQUEAR' ? 'Bloquear cuenta' : this.alertaAccion === 'DESCARTAR' ? 'Descartar alerta' : 'Resolver alerta'; }
  get descripcionAccion(): string { return this.alertaAccion === 'BLOQUEAR' ? 'La cuenta dejará de admitir débitos y la alerta quedará resuelta. Explica el motivo antes de confirmar.' : this.alertaAccion === 'DESCARTAR' ? 'La alerta quedará cerrada como descartada. Esta decisión no cambia el estado de la cuenta.' : 'La alerta quedará cerrada como resuelta. Esta decisión no cambia el estado de la cuenta.'; }
  masFiltros=false; filtroError='';
  get filtrosActivos():number {return [this.nivel,this.estado,this.tipo].filter(Boolean).length;}
  aplicarFiltros():void {this.filtroError='';this.buscar();}
  limpiarFiltros():void {this.nivel='';this.estado='';this.tipo='';this.filtroError='';this.masFiltros=false;this.buscar();}

  alertas: Alerta[] = []; niveles = ['BAJO', 'MEDIO', 'ALTO', 'CRITICO']; estados = ['PENDIENTE', 'EN_REVISION', 'RESUELTA', 'DESCARTADA'];
  tipos = ['MONTO_ELEVADO', 'TRANSACCION_REPETITIVA', 'CUENTA_NUEVA_CON_ALTO_MOVIMIENTO', 'INTENTOS_FALLIDOS'];
  nivel = ''; estado = 'PENDIENTE'; tipo = ''; pagina = 0; total = 0; totalPaginas = 0;
  alertaSeleccionada?: Alerta; alertaAccion: 'RESOLVER' | 'DESCARTAR' | 'BLOQUEAR' | '' = ''; observacion = '';
  constructor(private service: AlertaService, private snack: MatSnackBar, private dialog: MatDialog) {}
  ngOnInit(): void { this.cargar(); }
  buscar(): void { this.pagina = 0; this.cargar(); }
  cargar(): void {
    this.consulta?.unsubscribe(); this.loading = true; this.errorCarga = ''; this.alertas = [];
    this.consulta = this.service.getPage(this.pagina, 20, this.nivel, this.estado, this.tipo).pipe(timeout(15000)).subscribe({
      next: p => {
        if (this.pagina>0 && this.pagina>=p.totalPages) { this.pagina=Math.max(0,p.totalPages-1); this.cargar(); return; }
        this.alertas = p.content; this.total = p.totalElements; this.totalPaginas = p.totalPages; this.loading = false;
      },
      error: () => { this.loading = false; this.total = 0; this.totalPaginas = 0; this.errorCarga = 'No pudimos cargar las alertas. Intenta nuevamente.'; }
    });
  }
  cambiarPagina(delta: number): void { if (this.loading || this.pagina+delta<0 || this.pagina+delta>=this.totalPaginas) return; this.pagina += delta; this.cargar(); }
  resolver(alerta: Alerta, estado: 'RESUELTA' | 'DESCARTADA'): void { this.abrirDecision(alerta, estado === 'RESUELTA' ? 'RESOLVER' : 'DESCARTAR'); }
  bloquear(alerta: Alerta): void { this.abrirDecision(alerta, 'BLOQUEAR'); }
  private abrirDecision(alerta: Alerta, accion: 'RESOLVER' | 'DESCARTAR' | 'BLOQUEAR'): void {
    if (this.dialogRef || this.guardando || !['PENDIENTE','EN_REVISION'].includes(alerta.estado)) return;
    this.alertaSeleccionada=alerta; this.alertaAccion=accion; this.observacion=''; this.errorAccion='';
    this.dialogRef=this.dialog.open(this.decisionDialog,{width:'520px',maxWidth:'94vw',disableClose:true});
  }
  cerrarModal(): void { if(this.guardando)return; this.dialogRef?.close(); this.dialogRef=undefined; this.alertaAccion = ''; this.alertaSeleccionada = undefined; }
  confirmarAccion(): void {
    if (this.guardando || !this.alertaSeleccionada || !this.alertaAccion) return;
    if (!this.observacion.trim() || this.observacion.length>1000) { this.errorAccion='Escribe un motivo de hasta 1000 caracteres.'; return; }
    this.guardando=true; this.errorAccion='';
    const alerta = this.alertaSeleccionada;
    const request = this.alertaAccion === 'BLOQUEAR'
      ? this.service.bloquearCuenta(alerta.id, this.observacion.trim())
      : this.service.resolver(alerta.id, this.alertaAccion === 'RESOLVER' ? 'RESUELTA' : 'DESCARTADA', this.observacion.trim());
    this.decision=request.pipe(timeout(15000)).subscribe({
      next: () => { this.guardando=false; this.cerrarModal(); this.snack.open('Alerta actualizada', 'Cerrar', { duration: 2500 }); this.cargar(); },
      error: e => { this.guardando=false; this.errorAccion=e.error?.message || 'No pudimos confirmar el resultado. Conservamos tu motivo; revisa el estado de la alerta antes de volver a decidir.'; this.cargar(); }
    });
  }
  ngOnDestroy(): void { this.consulta?.unsubscribe(); this.decision?.unsubscribe(); this.dialogRef?.close(); }
  riesgoClase(nivel: string): string { return `risk-${nivel.toLowerCase()}`; }
}
