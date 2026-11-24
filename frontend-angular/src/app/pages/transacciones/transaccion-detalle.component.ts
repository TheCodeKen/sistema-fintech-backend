import { Component, OnInit, OnDestroy } from '@angular/core';
import { Subscription } from 'rxjs';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { TransaccionDetalle } from '../../models/models';
import { TransaccionService } from '../../services/transaccion.service';
import { AuthService } from '../../services/auth.service';
import { solicitarConfirmacion } from '../../components/confirmation-dialog.component';
import { estadoMovimiento, admiteReversion } from '../../models/transaction-status';

@Component({
  standalone:true,
  imports:[CommonModule,RouterLink,MatDialogModule],
  template:`
    <div class="page-container movement-detail">
      <a class="back" routerLink="/transacciones">← Volver a movimientos</a>
      <p *ngIf="loading" role="status">Cargando movimiento…</p>
      <p *ngIf="error" class="form-feedback" role="alert">{{error}} <button type="button" class="filter-clear" (click)="cargar()">Reintentar</button></p>
      <ng-container *ngIf="detalle as d">
        <header><div><span class="eyebrow">{{d.movimiento.numeroReferencia}}</span><h1>{{d.movimiento.tipoTransaccion.replaceAll('_',' ') | titlecase}}</h1><p>{{d.movimiento.fechaTransaccion | date:'dd/MM/yyyy HH:mm:ss'}}</p></div><span class="state" [class.warning]="d.movimiento.estado==='FALLIDA' || d.movimiento.estado==='REVERTIDA'">{{d.movimiento.estado}}</span></header>
        <section class="movement-card"><span class="amount-label">Importe del movimiento</span><strong class="amount">{{d.movimiento.moneda}} {{d.movimiento.monto | number:'1.2-2'}}</strong><p class="state-description" role="status">{{descripcionEstado(d.movimiento)}}</p>
          <dl><dt>{{['DEPOSITO','DESEMBOLSO_PRESTAMO'].includes(d.movimiento.tipoTransaccion) ? 'Cuenta abonada' : 'Cuenta de origen'}}</dt><dd>{{d.movimiento.numeroCuentaOrigen || 'Cuenta #'+d.movimiento.cuentaOrigenId}}</dd><ng-container *ngIf="d.movimiento.cuentaDestinoId"><dt>Cuenta de destino</dt><dd>{{d.movimiento.numeroCuentaDestino || 'Cuenta #'+d.movimiento.cuentaDestinoId}}</dd></ng-container><dt>Concepto</dt><dd>{{d.movimiento.descripcion || 'Sin concepto'}}</dd><dt>Referencia</dt><dd>{{d.movimiento.numeroReferencia}}</dd><ng-container *ngIf="d.original"><dt>Movimiento original</dt><dd><a [routerLink]="['/transacciones',d.original.id]">{{d.original.numeroReferencia}}</a></dd></ng-container><ng-container *ngIf="d.reversion"><dt>Reversión vinculada</dt><dd><a [routerLink]="['/transacciones',d.reversion.id]">{{d.reversion.numeroReferencia}}</a></dd></ng-container></dl>
          <div class="actions"><button type="button" class="filter-apply" *ngIf="['COMPLETADA','REVERTIDA'].includes(d.movimiento.estado || '')" [disabled]="descargando" (click)="descargar()">{{descargando ? 'Preparando…' : 'Descargar comprobante PDF'}}</button><button type="button" class="filter-clear" (click)="cargar()" [disabled]="loading">Actualizar estado</button><button type="button" class="filter-clear" *ngIf="puedeRevertir" [disabled]="revirtiendo" (click)="revertir()">{{revirtiendo ? 'Confirmando reversión…' : 'Revertir movimiento'}}</button></div>
          <p class="form-feedback" role="alert" *ngIf="accionError">{{accionError}}</p>
          <p class="footnote" *ngIf="!['COMPLETADA','REVERTIDA'].includes(d.movimiento.estado || '')">El comprobante estará disponible cuando se confirme el movimiento. Puedes retomar una operación pendiente desde el listado.</p>
        </section>
        <p class="footnote">El comprobante muestra el estado al momento de descargarlo. Las reversiones conservan la operación original y registran una compensación.</p>
      </ng-container>
    </div>
  `,
  styleUrl:'./transaccion-detalle.component.css'
})
export class TransaccionDetalleComponent implements OnInit, OnDestroy {
  detalle:TransaccionDetalle|null=null;loading=true;error='';accionError='';descargando=false;revirtiendo=false;
  descripcionEstado=estadoMovimiento;
  private id=0;
  private subscriptions=new Subscription();
  private consulta?:Subscription;
  constructor(private route:ActivatedRoute,private api:TransaccionService,private auth:AuthService,private dialog:MatDialog){}
  ngOnInit():void {
    this.subscriptions.add(this.route.paramMap.subscribe(params=>{this.id=Number(params.get('id'));this.cargar();}));
  }
  ngOnDestroy():void{this.consulta?.unsubscribe();this.subscriptions.unsubscribe();}
  get puedeRevertir():boolean{return this.auth.getSession()?.rol==='ADMIN' && !!this.detalle && admiteReversion(this.detalle.movimiento);}
  cargar():void {
    this.consulta?.unsubscribe();
    this.error='';this.accionError='';this.detalle=null;
    if(!Number.isSafeInteger(this.id)||this.id<=0){this.loading=false;this.error='El enlace del movimiento no es válido.';return;}
    this.loading=true;
    this.consulta=this.api.getDetalle(this.id).subscribe({next:d=>{this.detalle=d;this.loading=false;},error:e=>{this.loading=false;this.error=e.status===403?'No tienes acceso a este movimiento.':e.status===404?'No encontramos este movimiento.':'No pudimos consultar el movimiento. Intenta nuevamente.';}});
  }
  descargar():void {
    if(this.descargando||!this.detalle)return;
    this.descargando=true;this.accionError='';
    const id=this.id;
    this.api.comprobante(id).subscribe({next:blob=>{
      const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`comprobante-${id}.pdf`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);this.descargando=false;
    },error:()=>{this.descargando=false;this.accionError='No pudimos descargar el comprobante. Actualiza el estado e intenta nuevamente.';}});
  }
  async revertir():Promise<void>{
    if(this.revirtiendo||!this.puedeRevertir)return;
    const id=this.id,t=this.detalle!.movimiento;this.revirtiendo=true;
    const confirma=await solicitarConfirmacion(this.dialog,'Revertir movimiento',`Referencia ${t.numeroReferencia}. Cuenta ${t.numeroCuentaOrigen || t.cuentaOrigenId}. Se compensarán ${t.moneda} ${t.monto.toFixed(2)}. Se conservará el movimiento original.`);
    if(!confirma||this.id!==id){this.revirtiendo=false;return;}
    this.accionError='';
    this.api.revertir(id).subscribe({next:()=>{this.revirtiendo=false;if(this.id===id)this.cargar();},error:e=>{this.revirtiendo=false;if(this.id===id)this.accionError=e.error?.message||'No pudimos confirmar la reversión. Consulta el estado y reintenta sobre este mismo movimiento.';}});
  }
}
