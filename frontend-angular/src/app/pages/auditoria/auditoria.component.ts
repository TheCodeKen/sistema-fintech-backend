import { Subscription } from 'rxjs';
import { Component, OnInit, OnDestroy, TemplateRef, ViewChild } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuditoriaService } from '../../services/auditoria.service';
import { Auditoria } from '../../models/models';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';

@Component({
  selector: 'app-auditoria',
  standalone: true,
  imports: [CommonModule, FormsModule, DatePipe, MatButtonModule, MatCardModule, MatDialogModule,
    MatFormFieldModule, MatIconModule, MatInputModule, MatProgressSpinnerModule, MatSelectModule,
    MatTableModule, MatSnackBarModule],
  template: `
    <div class="page">
      <mat-card class="hero"><div><span class="eyebrow">Control interno</span><h1>Auditoría administrativa</h1>
        <p>Consulta trazable de las operaciones sensibles ejecutadas en la plataforma.</p></div><mat-icon>fact_check</mat-icon></mat-card>
      <section class="filter-shell" aria-label="Filtros de auditoria">
        <form (ngSubmit)="aplicarFiltros()">
          <div class="filter-line"><label class="filter-search"><mat-icon>search</mat-icon><input aria-label="Buscar por ejecutor" placeholder="Buscar por usuario ejecutor" [(ngModel)]="filtroUsuario" name="filtroUsuario"></label>
            <button class="filter-toggle" type="button" (click)="masFiltros=!masFiltros" [attr.aria-expanded]="masFiltros" aria-controls="advanced-auditoria"><mat-icon>tune</mat-icon>Más filtros<span class="filter-count" *ngIf="filtrosActivos">{{filtrosActivos}}</span></button>
            <button class="filter-apply" type="submit">Buscar</button>
            <button class="filter-clear" type="button" *ngIf="filtrosActivos" (click)="limpiarFiltros()">Limpiar</button>
          </div>
          <div class="filter-details" id="advanced-auditoria" *ngIf="masFiltros"><label>Acción<select [(ngModel)]="filtroAccion" name="filtroAccion"><option value="">Todas las acciones</option><option *ngFor="let a of acciones" [value]="a">{{a.replaceAll('_',' ')}}</option></select></label><label>Entidad<select [(ngModel)]="filtroEntidad" name="filtroEntidad"><option value="">Todas las entidades</option><option *ngFor="let e of entidades" [value]="e">{{e}}</option></select></label><label>Desde<input type="date" [(ngModel)]="desde" name="desde"></label><label>Hasta<input type="date" [(ngModel)]="hasta" name="hasta" [min]="desde"></label></div>
          <p class="filter-validation" role="alert" *ngIf="filtroError">{{filtroError}}</p>
        </form>
      </section>
      <mat-card class="table-card"><div class="heading"><div><h2>Eventos registrados</h2><p>{{errorCarga ? 'Consulta pendiente de recuperar' : total + ' eventos encontrados'}}</p></div><button mat-stroked-button (click)="buscar()"><mat-icon>refresh</mat-icon>Actualizar</button></div>
        <div class="table-wrap"><table mat-table [dataSource]="eventos">
          <ng-container matColumnDef="fecha"><th mat-header-cell *matHeaderCellDef>Fecha</th><td mat-cell *matCellDef="let e">{{ e.fechaRegistro | date:'dd/MM/yyyy HH:mm:ss' }}</td></ng-container>
          <ng-container matColumnDef="accion"><th mat-header-cell *matHeaderCellDef>Acción</th><td mat-cell *matCellDef="let e"><span class="action">{{ e.accion }}</span></td></ng-container>
          <ng-container matColumnDef="entidad"><th mat-header-cell *matHeaderCellDef>Entidad</th><td mat-cell *matCellDef="let e"><span class="entity" [class]="entidadClase(e.entidadAfectada)">{{ e.entidadAfectada }}</span> #{{ e.entidadId }}</td></ng-container>
          <ng-container matColumnDef="usuario"><th mat-header-cell *matHeaderCellDef>Ejecutor</th><td mat-cell *matCellDef="let e">{{ e.usuarioEjecutor }}<small>{{ e.rolEjecutor }}</small></td></ng-container>
          <ng-container matColumnDef="detalle"><th mat-header-cell *matHeaderCellDef>Detalle</th><td mat-cell *matCellDef="let e"><button mat-button color="primary" (click)="verDetalle(e)">Ver detalle</button></td></ng-container>
          <tr mat-header-row *matHeaderRowDef="columnas"></tr><tr mat-row *matRowDef="let row; columns: columnas"></tr>
        </table><div class="loading" *ngIf="loading"><mat-spinner diameter="38"></mat-spinner></div><div class="form-feedback" role="alert" *ngIf="errorCarga">{{errorCarga}} <button type="button" class="filter-clear" (click)="cargar()">Reintentar</button></div><div class="empty" *ngIf="!loading && !errorCarga && !eventos.length">No existen eventos para los filtros seleccionados.</div></div>
        <div class="pager"><button mat-button (click)="paginaAnterior()" [disabled]="pagina === 0">Anterior</button><span>Página {{ pagina + 1 }} de {{ totalPaginas || 1 }}</span><button mat-button (click)="paginaSiguiente()" [disabled]="pagina + 1 >= totalPaginas">Siguiente</button></div>
      </mat-card>
    </div>
    <ng-template #detalleDialog><h2 mat-dialog-title>Detalle de auditoría</h2><mat-dialog-content *ngIf="seleccionado"><p><strong>{{ seleccionado.accion }}</strong> · {{ seleccionado.entidadAfectada }} #{{ seleccionado.entidadId }}</p><p class="detail">{{ seleccionado.detalles || 'Sin detalle adicional.' }}</p><p>Ejecutor: {{ seleccionado.usuarioEjecutor }} ({{ seleccionado.rolEjecutor }})</p><p>IP: {{ seleccionado.ipOrigen || 'No disponible' }}</p></mat-dialog-content><mat-dialog-actions align="end"><button mat-button (click)="dialogRef?.close()">Cerrar</button></mat-dialog-actions></ng-template>
  `,
  styles: [`.page{display:grid;gap:18px}.hero,.filters,.table-card{border-radius:20px;border:1px solid #e2e8f0}.hero{display:flex;justify-content:space-between;align-items:center;background:linear-gradient(135deg,#fff,#eff6ff)}.hero h1{margin:4px 0;font-size:28px}.hero p,.heading p{color:#64748b}.hero mat-icon{font-size:48px;width:48px;height:48px;color:#2563eb}.eyebrow{color:#2563eb;font-size:12px;font-weight:700;text-transform:uppercase}.filters{display:flex;gap:12px;align-items:center;flex-wrap:wrap;padding:18px}.filters mat-form-field{min-width:160px}.table-card{padding:20px}.heading{display:flex;justify-content:space-between;align-items:center}.heading h2{margin:0}.table-wrap{overflow:auto;border:1px solid #e2e8f0;border-radius:14px;position:relative}.table-wrap table{width:100%;min-width:800px}.table-wrap th{background:#f8fafc;color:#64748b;font-size:12px}.action{font-weight:700;color:#334155}.entity{border-radius:999px;padding:5px 9px;font-size:11px;font-weight:700;background:#e2e8f0;color:#475569}.entity-cuenta{background:#dcfce7;color:#166534}.entity-transaccion{background:#ede9fe;color:#6d28d9}.entity-prestamo{background:#fef3c7;color:#92400e}.entity-usuario{background:#dbeafe;color:#1d4ed8}.table-wrap small{display:block;color:#64748b}.loading,.empty{text-align:center;padding:32px}.pager{display:flex;justify-content:center;align-items:center;gap:18px;padding-top:14px}.detail{white-space:pre-wrap;background:#f8fafc;border-radius:10px;padding:14px}`]
})
export class AuditoriaComponent implements OnInit, OnDestroy {
  masFiltros=false; filtroError='';
  get filtrosActivos():number {return [this.filtroUsuario.trim(),this.filtroAccion,this.filtroEntidad,this.desde,this.hasta].filter(Boolean).length;}
  aplicarFiltros():void {this.filtroError='';if(this.desde && this.hasta && this.desde>this.hasta){this.filtroError='La fecha inicial debe ser anterior a la fecha final.';return;}this.buscar();}
  limpiarFiltros():void {this.filtroUsuario='';this.filtroAccion='';this.filtroEntidad='';this.desde='';this.hasta='';this.filtroError='';this.masFiltros=false;this.buscar();}

  eventos: Auditoria[] = []; columnas = ['fecha', 'accion', 'entidad', 'usuario', 'detalle'];
  acciones = ['CREACION_USUARIO','ACTIVACION_USUARIO','DESACTIVACION_USUARIO','CAMBIO_ROL_USUARIO',
    'ACTIVACION_CUENTA','BLOQUEO_CUENTA','CONGELAMIENTO_CUENTA','DESBLOQUEO_CUENTA','CIERRE_CUENTA',
    'MOVIMIENTO_COMPLETADO','REVERSION_TRANSACCION','REVISION_PRESTAMO','APROBACION_PRESTAMO','RECHAZO_PRESTAMO',
    'DESEMBOLSO_PRESTAMO','PAGO_PRESTAMO','CANCELACION_PRESTAMO','VENCIMIENTO_PRESTAMO','REGULARIZACION_PRESTAMO'];
  entidades = ['USUARIO','CUENTA','TRANSACCION','PRESTAMO']; filtroAccion=''; filtroEntidad=''; filtroUsuario=''; desde=''; hasta='';
  errorCarga='';private consulta?:Subscription;
  pagina=0; totalPaginas=0; total=0; loading=false; seleccionado?: Auditoria; dialogRef: MatDialogRef<unknown>|null=null;
  @ViewChild('detalleDialog') detalleTpl!: TemplateRef<unknown>;
  constructor(private service: AuditoriaService, private dialog: MatDialog, private snack: MatSnackBar) {}
  ngOnInit(): void { this.buscar(); }
  buscar(): void { this.pagina=0; this.cargar(); }
  cargar(): void { this.consulta?.unsubscribe();this.loading=true;this.errorCarga='';this.consulta=this.service.getPage(this.pagina,20,this.filtroAccion,this.filtroEntidad,this.filtroUsuario,this.desde,this.hasta).subscribe({next:p=>{this.eventos=p.content;this.total=p.totalElements;this.totalPaginas=p.totalPages;this.loading=false;},error:()=>{this.loading=false;this.eventos=[];this.total=0;this.totalPaginas=0;this.errorCarga='El servicio de auditoría no está disponible. Reintenta la consulta en unos momentos.';}}); }
  paginaAnterior(): void { if(this.pagina>0){this.pagina--;this.cargar();} }
  paginaSiguiente(): void { if(this.pagina+1<this.totalPaginas){this.pagina++;this.cargar();} }
  verDetalle(evento: Auditoria): void { this.seleccionado=evento; this.dialogRef=this.dialog.open(this.detalleTpl,{width:'min(92vw,620px)'}); }
  entidadClase(entidad: string): string { return 'entity-'+entidad.toLowerCase(); }
  ngOnDestroy():void {this.consulta?.unsubscribe();this.dialogRef?.close();}
}
