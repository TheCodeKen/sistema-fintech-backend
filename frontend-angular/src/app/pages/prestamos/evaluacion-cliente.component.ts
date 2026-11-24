import { Component, Input, Output, EventEmitter, OnChanges, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Subscription, timeout } from 'rxjs';
import { EvaluacionCliente, Prestamo } from '../../models/models';
import { PrestamoService } from '../../services/prestamo.service';

@Component({
  selector:'app-evaluacion-cliente',
  standalone:true,
  imports:[CommonModule,FormsModule,RouterLink],
  template:`
    <section class="evaluation" aria-labelledby="evaluation-title">
      <header><div><h2 id="evaluation-title">Historial interno del cliente</h2><p>Registros de esta aplicación. La solicitud actual se excluye de los antecedentes.</p></div><button type="button" class="filter-clear" [disabled]="cargando || enviando" (click)="cargar()">Actualizar ficha</button></header>
      <p role="status" *ngIf="cargando">Consultando préstamos y pagos…</p>
      <p class="form-feedback" role="alert" *ngIf="error">{{error}}</p>
      <ng-container *ngIf="datos as d">
        <p class="cutoff">Corte al {{d.fechaCorte | date:'dd/MM/yyyy'}} · Información interna, sin reporte de una central de riesgo.</p>
        <p class="form-note" *ngIf="!d.totalOtrosPrestamos">Sin historial registrado en la aplicación. La ausencia de antecedentes no indica un comportamiento negativo.</p>
        <div class="history-counts"><article><span>Otros préstamos</span><strong>{{d.totalOtrosPrestamos}}</strong></article><article><span>Pagados</span><strong>{{d.porEstado['PAGADO'] || 0}}</strong></article><article><span>Solicitudes pendientes</span><strong>{{(d.porEstado['PENDIENTE'] || 0)+(d.porEstado['EN_REVISION'] || 0)}}</strong></article><article><span>Rechazados</span><strong>{{d.porEstado['RECHAZADO'] || 0}}</strong></article></div>
        <p class="form-feedback" role="status" *ngIf="d.prestamosSinCronograma">{{d.prestamosSinCronograma}} préstamo(s) vigente(s) sin cronograma completo. Los vencimientos registrados pueden estar incompletos. Consulta sus detalles antes de decidir.</p>
        <div class="balances" *ngIf="d.saldos.length; else sinDeuda"><article *ngFor="let s of d.saldos"><h3>{{s.moneda}} · {{s.prestamosVigentes}} préstamo(s) vigente(s)</h3><dl><dt>Deuda registrada</dt><dd>{{s.moneda}} {{s.saldoPendiente | number:'1.2-2'}}</dd><dt>Cuotas mensuales pactadas</dt><dd>{{s.moneda}} {{s.cuotaMensual | number:'1.2-2'}}</dd><dt>Cuotas vencidas registradas</dt><dd>{{s.cuotasVencidas}}</dd><dt>Importe vencido registrado</dt><dd>{{s.moneda}} {{s.saldoVencido | number:'1.2-2'}}</dd><ng-container *ngIf="s.primerVencimiento"><dt>Vencimiento más antiguo</dt><dd>{{s.primerVencimiento | date:'dd/MM/yyyy'}}</dd></ng-container></dl></article></div>
        <ng-template #sinDeuda><p>Sin otros préstamos desembolsados con deuda registrada.</p></ng-template>
        <details *ngIf="d.totalOtrosPrestamos"><summary>Otros préstamos · {{d.totalOtrosPrestamos}}</summary><div class="table-scroll"><table><thead><tr><th>Referencia</th><th>Fecha</th><th>Importe solicitado</th><th>Estado</th></tr></thead><tbody><tr *ngFor="let p of d.prestamosRecientes"><td><a [routerLink]="['/prestamos',p.id]">{{p.numeroPrestamo}}</a></td><td>{{p.fechaSolicitud | date:'dd/MM/yyyy'}}</td><td>{{p.moneda}} {{p.montoSolicitado | number:'1.2-2'}}</td><td>{{p.estado?.replaceAll('_',' ')}}</td></tr></tbody></table></div><nav class="history-pages" aria-label="Páginas del historial" *ngIf="d.totalPaginasPrestamos>1"><button type="button" class="filter-clear" [disabled]="cargando || enviando || d.paginaPrestamos===0" (click)="cargar(d.paginaPrestamos-1)">Anterior</button><span>Página {{d.paginaPrestamos+1}} de {{d.totalPaginasPrestamos}}</span><button type="button" class="filter-clear" [disabled]="cargando || enviando || d.paginaPrestamos+1>=d.totalPaginasPrestamos" (click)="cargar(d.paginaPrestamos+1)">Siguiente</button></nav></details>
        <details><summary>Pagos anteriores · {{d.pagosRecientes.length}} de {{d.totalPagos}}</summary><p *ngIf="!d.totalPagos">Sin pagos registrados en otros préstamos.</p><div class="table-scroll" *ngIf="d.pagosRecientes.length"><table><thead><tr><th>Fecha</th><th>Préstamo</th><th>Importe</th><th>Referencia</th></tr></thead><tbody><tr *ngFor="let p of d.pagosRecientes"><td>{{p.fechaPago ? (p.fechaPago | date:'dd/MM/yyyy HH:mm') : 'Fecha histórica no disponible'}}</td><td><a [routerLink]="['/prestamos',p.prestamoId]">{{p.numeroPrestamo}}</a></td><td>{{p.moneda}} {{p.monto | number:'1.2-2'}}</td><td><a *ngIf="p.transaccionId; else sinReferencia" [routerLink]="['/transacciones',p.transaccionId]">Movimiento #{{p.transaccionId}}</a><ng-template #sinReferencia>Registro histórico</ng-template></td></tr></tbody></table></div></details>
        <section class="decision" *ngIf="d.solicitud.estado==='PENDIENTE'"><h3>Revisar solicitud</h3><p>Consulta los antecedentes y los datos de esta solicitud antes de registrar una decisión.</p><button type="button" class="filter-apply" [disabled]="cargando || enviando || !!error" (click)="iniciarRevision()">{{enviando ? 'Actualizando…' : 'Iniciar revisión'}}</button></section>
        <form class="decision" *ngIf="d.solicitud.estado==='EN_REVISION'" (ngSubmit)="confirmarDecision()">
          <h3>Decisión del administrador</h3><p>El historial interno aporta antecedentes. Evalúa también la capacidad de pago y la documentación del cliente.</p>
          <label class="ack"><input type="checkbox" name="revisado" [(ngModel)]="revisado" [disabled]="enviando || cargando">He revisado el historial interno y los datos de la solicitud.</label>
          <label>Decisión<select name="decision" [(ngModel)]="decision" [disabled]="enviando || cargando"><option value="">Selecciona una decisión</option><option value="APROBAR">Aprobar solicitud</option><option value="RECHAZAR">Rechazar solicitud</option></select></label>
          <label>{{decision==='RECHAZAR' ? 'Motivo de rechazo' : 'Observación de la evaluación'}}<textarea name="observacion" [(ngModel)]="observacion" rows="3" minlength="5" maxlength="500" required [disabled]="enviando || cargando"></textarea><small>De 5 a 500 caracteres. Quedará registrado en la solicitud.</small></label>
          <p class="form-note" *ngIf="decision">{{decision==='APROBAR' ? 'Confirmar registrará la aprobación. El desembolso se realiza en un paso posterior.' : 'Confirmar registrará el rechazo y su motivo.'}}</p>
          <button type="submit" class="filter-apply" [disabled]="!puedeConfirmar">{{enviando ? 'Confirmando…' : 'Confirmar decisión'}}</button>
        </form>
      </ng-container>
    </section>
  `,
  styleUrl:'./evaluacion-cliente.component.css'
})
export class EvaluacionClienteComponent implements OnChanges, OnDestroy {
  @Input({required:true}) prestamo!:Prestamo;
  @Output() actualizado=new EventEmitter<void>();
  datos:EvaluacionCliente|null=null;
  cargando=false;enviando=false;error='';revisado=false;decision='';observacion='';
  private ultimoId?:number;
  private consulta?:Subscription;
  private peticion?:Subscription;
  constructor(private api:PrestamoService) {}
  ngOnChanges():void {
    if(this.prestamo.id===this.ultimoId)return;
    this.ultimoId=this.prestamo.id;this.datos=null;this.decision='';this.observacion='';this.cargar();
  }
  get puedeConfirmar():boolean {
    return !this.enviando && !this.cargando && !this.error && this.datos?.solicitud.estado==='EN_REVISION' && this.revisado
      && ['APROBAR','RECHAZAR'].includes(this.decision) && this.observacion.trim().length>=5 && this.observacion.trim().length<=500;
  }
  cargar(pagina=0):void {
    if(this.enviando || !this.prestamo.id)return;
    this.consulta?.unsubscribe();this.cargando=true;this.revisado=false;this.error='';
    this.consulta=this.api.getEvaluacion(this.prestamo.id,pagina).subscribe({
      next:datos=>{this.datos=datos;this.cargando=false;if(datos.solicitud.estado!==this.prestamo.estado)this.actualizado.emit();},
      error:()=>{this.datos=null;this.cargando=false;this.error='No pudimos cargar la ficha. Actualízala para continuar con la evaluación.';}
    });
  }
  iniciarRevision():void {
    if(this.enviando || this.cargando || this.error || this.datos?.solicitud.estado!=='PENDIENTE')return;
    this.ejecutar(this.api.revisar(this.prestamo.id!));
  }
  confirmarDecision():void {
    if(!this.puedeConfirmar)return;
    const texto=this.observacion.trim();
    this.ejecutar(this.decision==='APROBAR' ? this.api.aprobar(this.prestamo.id!,texto) : this.api.rechazar(this.prestamo.id!,texto));
  }
  private ejecutar(operacion:ReturnType<PrestamoService['revisar']>):void {
    this.enviando=true;this.error='';
    this.peticion=operacion.pipe(timeout(15000)).subscribe({
      next:()=>{this.enviando=false;this.revisado=false;this.decision='';this.observacion='';this.actualizado.emit();this.cargar();},
      error:e=>{this.enviando=false;this.error=e.error?.message || 'No pudimos confirmar el resultado. Actualiza la ficha para comprobar el estado antes de reintentar.';}
    });
  }
  ngOnDestroy():void {this.consulta?.unsubscribe();this.peticion?.unsubscribe();}
}
