import { Component, OnInit, OnDestroy } from '@angular/core';
import { Subscription } from 'rxjs';
import { EvaluacionClienteComponent } from './evaluacion-cliente.component';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { PrestamoService } from '../../services/prestamo.service';
import { CuentaService } from '../../services/cuenta.service';
import { AuthService } from '../../services/auth.service';
import { Cuenta, PrestamoDetalle } from '../../models/models';
import { importeValido } from '../../models/form-rules';

@Component({
  standalone:true,
  imports:[CommonModule,FormsModule,RouterLink,EvaluacionClienteComponent],
  template:`
    <main class="page-container loan-detail">
      <a class="back-link" routerLink="/prestamos">← Volver a préstamos</a>
      <div *ngIf="loading" role="status" class="detail-message">Cargando el detalle del préstamo…</div>
      <div *ngIf="error" class="form-feedback" role="alert">{{error}} <button type="button" class="filter-clear" (click)="cargar()">Reintentar</button></div>
      <ng-container *ngIf="detalle as d">
        <header class="detail-heading"><div><span class="eyebrow">{{d.prestamo.numeroPrestamo}}</span><h1>{{d.prestamo.tipoPrestamo | titlecase}}</h1><p>{{d.prestamo.nombreUsuario}} · {{d.prestamo.numeroCuenta}}</p></div><span class="loan-state" [class.overdue]="d.prestamo.estado==='VENCIDO'">{{d.prestamo.estado?.replaceAll('_',' ')}}</span></header>
        <p class="form-note" *ngIf="d.advertencia">{{d.advertencia}}</p>
        <section class="detail-metrics" aria-label="Resumen del préstamo">
          <article><span>Capital solicitado</span><strong>{{d.prestamo.moneda}} {{d.prestamo.montoSolicitado | number:'1.2-2'}}</strong></article>
          <article><span>Total de cuotas</span><strong>{{d.prestamo.moneda}} {{d.totalPactado | number:'1.2-2'}}</strong></article>
          <article><span>Pagos registrados</span><strong>{{d.prestamo.moneda}} {{d.totalPagado | number:'1.2-2'}}</strong></article>
          <article><span>{{['PENDIENTE','EN_REVISION','APROBADO'].includes(d.prestamo.estado || '') ? 'Total estimado al desembolsar' : 'Saldo por pagar'}}</span><strong>{{d.prestamo.moneda}} {{(['CANCELADO','RECHAZADO'].includes(d.prestamo.estado || '') ? 0 : d.prestamo.saldoPendiente) | number:'1.2-2'}}</strong></article>
        </section>
        <app-evaluacion-cliente *ngIf="isAdmin" [prestamo]="d.prestamo" (actualizado)="cargar()"></app-evaluacion-cliente>
        <section class="detail-card" *ngIf="d.cuotas.length">
          <div class="section-heading"><div><h2>{{d.saldoVencido>0 ? 'Tienes cuotas por regularizar' : d.proximoVencimiento ? 'Tu próxima cuota' : 'Préstamo pagado'}}</h2><p *ngIf="d.proximoVencimiento">{{d.proximoVencimiento | date:'dd/MM/yyyy'}} · {{d.prestamo.moneda}} {{d.importeProximaCuota | number:'1.2-2'}}</p><p *ngIf="d.saldoVencido>0">Saldo vencido: {{d.prestamo.moneda}} {{d.saldoVencido | number:'1.2-2'}} · {{d.cuotasVencidas}} cuota(s)</p><p *ngIf="!d.proximoVencimiento">Todas las cuotas están cubiertas.</p></div><button type="button" class="filter-apply detail-button" *ngIf="puedePagar && !mostrarPago" (click)="abrirPago()">Registrar pago</button></div>
          <progress [value]="d.totalPagado" [max]="d.totalPactado || 1" aria-label="Progreso de pagos"></progress><small>{{d.cuotasPagadas}} de {{d.cuotas.length}} cuotas pagadas</small>
        </section>
        <form class="detail-card payment-form" *ngIf="mostrarPago && puedePagar" (ngSubmit)="pagar()">
          <h2>{{resultadoIncierto ? 'Confirma el resultado de tu pago' : 'Registrar un pago'}}</h2>
          <p>El importe se aplicará primero a las cuotas más antiguas. Puedes realizar pagos parciales.</p>
          <p class="form-feedback" role="alert" *ngIf="pagoError">{{pagoError}}</p>
          <p class="form-note" *ngIf="!cuentas.length">No hay cuentas activas en la moneda del préstamo. Activa o financia una cuenta para pagar.</p>
          <div class="payment-fields"><label>Cuenta para debitar<select [(ngModel)]="cuentaId" name="cuenta" required [disabled]="pagando || resultadoIncierto"><option [ngValue]="0">Selecciona una cuenta</option><option *ngFor="let c of cuentas" [ngValue]="c.id">{{c.numeroCuenta}} · {{c.moneda}} {{c.saldo | number:'1.2-2'}}</option></select></label><label>Importe {{d.prestamo.moneda}}<input type="number" min="0.01" step="0.01" [(ngModel)]="monto" name="monto" required [disabled]="pagando || resultadoIncierto"></label></div>
          <p class="form-note">{{d.prestamo.moneda}} {{monto || 0 | number:'1.2-2'}} se debitarán de la cuenta seleccionada.</p>
          <div class="detail-actions"><button type="button" class="filter-clear" (click)="mostrarPago=false" [disabled]="pagando || resultadoIncierto">Cancelar</button><button type="submit" class="filter-apply detail-button" [disabled]="pagando || (!resultadoIncierto && !pagoValido)">{{pagando ? 'Confirmando…' : resultadoIncierto ? 'Consultar y confirmar pago' : 'Confirmar pago'}}</button></div>
        </form>
        <section class="detail-card">
          <div class="detail-tabs" role="tablist" aria-label="Información del préstamo"><button type="button" role="tab" [attr.aria-selected]="tab==='cuotas'" (click)="tab='cuotas'">Cronograma <span>{{d.cuotas.length}}</span></button><button type="button" role="tab" [attr.aria-selected]="tab==='pagos'" (click)="tab='pagos'">Historial de pagos <span>{{d.pagos.length}}</span></button><button type="button" role="tab" [attr.aria-selected]="tab==='solicitud'" (click)="tab='solicitud'">Solicitud</button></div>
          <div *ngIf="tab==='cuotas'" role="tabpanel" aria-label="Cronograma de cuotas">
            <div class="detail-message" *ngIf="!d.cuotas.length">{{d.prestamo.estado==='CANCELADO' || d.prestamo.estado==='RECHAZADO' ? 'Esta solicitud no generó cuotas.' : 'El cronograma se genera al confirmar el desembolso.'}}</div>
            <div class="detail-table" *ngIf="d.cuotas.length"><table><thead><tr><th>Cuota</th><th>Vencimiento</th><th>Importe</th><th>Pagado</th><th>Pendiente</th><th>Estado</th></tr></thead><tbody><tr *ngFor="let c of d.cuotas"><td>{{c.numero}}</td><td>{{c.vencimiento | date:'dd/MM/yyyy'}}</td><td>{{d.prestamo.moneda}} {{c.importe | number:'1.2-2'}}</td><td>{{c.pagado | number:'1.2-2'}}</td><td>{{c.pendiente | number:'1.2-2'}}</td><td><span class="loan-state" [class.overdue]="c.estado==='VENCIDA'">{{c.estado}}</span></td></tr></tbody></table></div>
          </div>
          <div *ngIf="tab==='pagos'" role="tabpanel" aria-label="Historial de pagos"><p class="detail-message" *ngIf="!d.pagos.length">Aún no se han registrado pagos.</p><div class="detail-table" *ngIf="d.pagos.length"><table><thead><tr><th>Fecha</th><th>Cuenta</th><th>Importe</th><th>Referencia</th></tr></thead><tbody><tr *ngFor="let p of pagosRecientes"><td>{{p.fechaPago ? (p.fechaPago | date:'dd/MM/yyyy HH:mm') : 'Fecha histórica no disponible'}}</td><td>#{{p.cuentaId}}</td><td>{{d.prestamo.moneda}} {{p.monto | number:'1.2-2'}}</td><td>{{p.transaccionId ? 'Transacción #'+p.transaccionId : 'Registro histórico'}}<small class="payment-reference">{{p.operacionId}}</small></td></tr></tbody></table></div></div>
          <dl class="request-details" *ngIf="tab==='solicitud'" role="tabpanel" aria-label="Datos de la solicitud"><dt>Solicitud</dt><dd>{{d.prestamo.fechaSolicitud | date:'dd/MM/yyyy HH:mm'}}</dd><dt>Tasa anual</dt><dd>{{d.prestamo.tasaInteres}}%</dd><dt>Plazo</dt><dd>{{d.prestamo.plazoMeses}} meses</dd><dt>Aprobación</dt><dd>{{d.prestamo.fechaAprobacion ? (d.prestamo.fechaAprobacion | date:'dd/MM/yyyy') : 'Pendiente'}}</dd><dt>Desembolso</dt><dd>{{d.prestamo.fechaDesembolso ? (d.prestamo.fechaDesembolso | date:'dd/MM/yyyy') : 'No registrado'}}</dd><dt>Vencimiento final</dt><dd>{{d.prestamo.fechaVencimiento ? (d.prestamo.fechaVencimiento | date:'dd/MM/yyyy') : 'Se define al desembolsar'}}</dd><ng-container *ngIf="d.prestamo.observacion"><dt>Observación</dt><dd>{{d.prestamo.observacion}}</dd></ng-container><ng-container *ngIf="d.prestamo.motivoRechazo"><dt>Motivo de rechazo</dt><dd>{{d.prestamo.motivoRechazo}}</dd></ng-container><ng-container *ngIf="d.prestamo.motivoCancelacion"><dt>Cancelación</dt><dd>{{d.prestamo.motivoCancelacion}} · {{d.prestamo.fechaCancelacion | date:'dd/MM/yyyy HH:mm'}}</dd></ng-container></dl>
        </section>
        <section class="detail-card" *ngIf="puedeCancelar"><h2>Cancelar solicitud</h2><p>La cancelación conserva el historial y no mueve dinero. {{isAdmin ? 'Puedes cancelar antes del desembolso.' : 'Disponible mientras la solicitud esté pendiente o en revisión.'}}</p><button *ngIf="!mostrarCancelacion" class="filter-clear" type="button" (click)="mostrarCancelacion=true">Cancelar esta solicitud</button><form *ngIf="mostrarCancelacion" (ngSubmit)="cancelar()"><label class="cancel-label">Motivo<textarea name="motivo" [(ngModel)]="motivo" maxlength="500" minlength="5" rows="3" required></textarea></label><div class="form-feedback" role="alert" *ngIf="cancelacionError">{{cancelacionError}}</div><div class="detail-actions"><button type="button" class="filter-clear" [disabled]="cancelando" (click)="mostrarCancelacion=false">Conservar solicitud</button><button type="submit" class="filter-apply detail-button" [disabled]="cancelando || motivo.trim().length<5">{{cancelando ? 'Cancelando…' : 'Confirmar cancelación'}}</button></div></form></section>
        <p class="detail-footnote">Cuotas fijas con los intereses pactados incluidos. No se aplican cargos adicionales por vencimiento.</p>
      </ng-container>
    </main>
  `,
  styleUrl:'./prestamo-detalle.component.css'
})
export class PrestamoDetalleComponent implements OnInit, OnDestroy {
  detalle:PrestamoDetalle|null=null; loading=true;error='';tab='cuotas';
  mostrarPago=false;pagando=false;pagoError='';cuentas:Cuenta[]=[];cuentaId=0;monto=0;operacionId='';resultadoIncierto=false;
  mostrarCancelacion=false;cancelando=false;motivo='';cancelacionError='';
  private id=0;
  private parametros?:Subscription;
  private consulta?:Subscription;
  private consultaCuentas?:Subscription;
  constructor(private route:ActivatedRoute,private prestamos:PrestamoService,private cuentaService:CuentaService,private auth:AuthService) {}
  ngOnInit():void {
    this.parametros=this.route.paramMap.subscribe(params=>{
      this.consultaCuentas?.unsubscribe();this.detalle=null;this.mostrarPago=false;this.mostrarCancelacion=false;
      this.resultadoIncierto=false;this.pagando=false;this.cancelando=false;this.cuentas=[];this.tab='cuotas';this.motivo='';this.pagoError='';this.cancelacionError='';
      this.id=Number(params.get('id'));this.cargar();
    });
  }
  get isAdmin():boolean {return this.auth.getSession()?.rol==='ADMIN';}
  get puedePagar():boolean {return !!this.detalle && ['DESEMBOLSADO','VENCIDO'].includes(this.detalle.prestamo.estado || '') && this.detalle.prestamo.saldoPendiente!>0;}
  get puedeCancelar():boolean {return !!this.detalle && (['PENDIENTE','EN_REVISION'].includes(this.detalle.prestamo.estado || '') || this.isAdmin && this.detalle.prestamo.estado==='APROBADO');}
  get pagosRecientes(){return this.detalle ? [...this.detalle.pagos].reverse() : [];}
  private get storageKey():string {return `fintech_pago_${this.auth.getSession()?.usuarioId}_${this.id}`;}
  cargar():void {
    this.consulta?.unsubscribe();
    if(!Number.isSafeInteger(this.id)||this.id<=0){this.loading=false;this.error='El enlace del préstamo no es válido.';return;}
    this.loading=true;this.error='';
    this.consulta=this.prestamos.getDetalle(this.id).subscribe({next:d=>{
      this.detalle=d;this.loading=false;
      const raw=sessionStorage.getItem(this.storageKey);
      if(raw){
        try {
          const pendiente=JSON.parse(raw);
          if(d.pagos.some(p=>p.operacionId===`prestamo:${this.id}:pago:${pendiente.operacionId}`)){
            sessionStorage.removeItem(this.storageKey);this.mostrarPago=false;this.resultadoIncierto=false;
          }else if(this.puedePagar&&!this.mostrarPago)this.abrirPago();
        }catch{sessionStorage.removeItem(this.storageKey);}
      }
    },error:e=>{this.loading=false;this.detalle=null;this.error=e.status===403?'No tienes acceso a este préstamo.':e.status===404?'No encontramos este préstamo.':'No pudimos cargar el préstamo. Intenta nuevamente.';}});
  }
  abrirPago():void {
    if(!this.detalle||!this.puedePagar)return;
    this.mostrarPago=true;this.pagoError='';this.resultadoIncierto=false;this.operacionId=crypto.randomUUID();
    this.monto=this.detalle.saldoVencido>0?this.detalle.saldoVencido:this.detalle.importeProximaCuota;this.cuentaId=0;
    try {const raw=sessionStorage.getItem(this.storageKey);if(raw){const p=JSON.parse(raw);if(p.operacionId&&importeValido(p.monto)&&p.cuentaId>0){this.operacionId=p.operacionId;this.cuentaId=p.cuentaId;this.monto=p.monto;this.resultadoIncierto=true;this.pagoError='Hay un pago pendiente de confirmar. Reintenta con los mismos datos.';}}}catch{sessionStorage.removeItem(this.storageKey);}
    this.consultaCuentas?.unsubscribe();
    this.consultaCuentas=this.cuentaService.getByUsuario(this.detalle.prestamo.usuarioId).subscribe({next:c=>{this.cuentas=c.filter(c=>c.estado==='ACTIVA'&&c.moneda===this.detalle?.prestamo.moneda);if(!this.resultadoIncierto)this.cuentaId=this.cuentas[0]?.id || 0;},error:()=>this.pagoError='No pudimos cargar las cuentas. Puedes reintentar cuando el servicio esté disponible.'});
  }
  get pagoValido():boolean {const c=this.cuentas.find(c=>c.id===this.cuentaId);return importeValido(this.monto)&&!!c&&this.monto<=Number(c.saldo||0)&&this.monto<=Number(this.detalle?.prestamo.saldoPendiente||0);}
  pagar():void {
    if(this.pagando||(!this.resultadoIncierto&&!this.pagoValido))return;
    const id=this.id;
    const storageKey=this.storageKey;
    this.pagando=true;this.pagoError='';
    sessionStorage.setItem(storageKey,JSON.stringify({cuentaId:this.cuentaId,monto:this.monto,operacionId:this.operacionId}));
    this.prestamos.pagar(id,this.monto,this.cuentaId,this.operacionId).subscribe({
      next:()=>{
        sessionStorage.removeItem(storageKey);
        if(this.id!==id)return;
        this.pagando=false;this.mostrarPago=false;this.resultadoIncierto=false;this.cargar();
      },
      error:e=>{
        const incierto=e.status===0||e.status>=500;
        if(!incierto)sessionStorage.removeItem(storageKey);
        if(this.id!==id)return;
        this.pagando=false;this.resultadoIncierto=incierto;this.pagoError=e.error?.message||'No pudimos confirmar el pago.';
        if(!incierto)this.operacionId=crypto.randomUUID();
        else this.pagoError+=' Reintenta para confirmar el resultado, conservando la misma operación.';
      }
    });
  }
  cancelar():void {
    if(this.cancelando||!this.puedeCancelar||this.motivo.trim().length<5)return;
    const id=this.id;
    this.cancelando=true;this.cancelacionError='';
    this.prestamos.cancelar(id,this.motivo.trim()).subscribe({
      next:()=>{if(this.id!==id)return;this.cancelando=false;this.mostrarCancelacion=false;this.cargar();},
      error:e=>{if(this.id!==id)return;this.cancelando=false;this.cancelacionError=e.error?.message||'No se pudo cancelar la solicitud.';}
    });
  }
  ngOnDestroy():void {this.parametros?.unsubscribe();this.consulta?.unsubscribe();this.consultaCuentas?.unsubscribe();}
}
