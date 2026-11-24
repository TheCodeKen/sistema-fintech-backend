import { importeValido, errorTransferencia } from '../../models/form-rules';
import { Component, OnInit, OnDestroy, TemplateRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TransaccionService } from '../../services/transaccion.service';
import { CuentaService } from '../../services/cuenta.service';
import { AuthService } from '../../services/auth.service';
import { Cuenta, Transaccion, RevisionMovimiento } from '../../models/models';
import { CuentaVisiblePipe } from '../../pipes/cuenta-visible.pipe';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDialog, MatDialogModule, MatDialogRef, MatDialogState } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTableModule } from '@angular/material/table';
import { forkJoin, map, of, switchMap, Subscription, timeout } from 'rxjs';
import { Router, RouterLink } from '@angular/router';
import { MovimientoPendienteService } from '../../services/movimiento-pendiente.service';
import { admiteReversion } from '../../models/transaction-status';

@Component({
  selector: 'app-transacciones',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, CuentaVisiblePipe, MatButtonModule, MatCardModule,
    MatDialogModule, MatFormFieldModule, MatIconModule, MatInputModule,
    MatProgressSpinnerModule, MatSelectModule, MatAutocompleteModule, MatSnackBarModule, MatTableModule],
  template: `
    <div class="page-container">
      <mat-card class="toolbar"><div><h1>{{isAdmin ? 'Gestión de Transacciones' : 'Mis Transacciones'}}</h1><p>Consulta tus movimientos y realiza nuevas operaciones.</p></div>
        <button mat-raised-button color="primary" (click)="abrirModal()">{{tienePendiente ? 'Retomar operación' : 'Nueva transacción'}}</button></mat-card>
      <p class="form-feedback" role="status" *ngIf="tienePendiente">Hay una operación pendiente de confirmar. Retómala con los mismos datos antes de iniciar otra.</p>
      <section class="filter-shell" *ngIf="isAdmin" aria-label="Filtros de transacciones">
        <form (ngSubmit)="aplicarFiltros()">
          <div class="filter-line"><label class="filter-search"><mat-icon>search</mat-icon><input aria-label="Buscar movimientos por cuenta" placeholder="Buscar por número de cuenta" [(ngModel)]="numeroCuenta" name="numeroCuenta"></label>
            <button class="filter-toggle" type="button" (click)="masFiltros=!masFiltros" [attr.aria-expanded]="masFiltros" aria-controls="advanced-transacciones"><mat-icon>tune</mat-icon>Más filtros<span class="filter-count" *ngIf="filtrosActivos">{{filtrosActivos}}</span></button>
            <button class="filter-apply" type="submit">Buscar</button>
            <button class="filter-clear" type="button" *ngIf="filtrosActivos" (click)="limpiarFiltros()">Limpiar</button>
          </div>
          <div class="filter-details" id="advanced-transacciones" *ngIf="masFiltros"><label>Movimiento<select [(ngModel)]="tipo" name="tipo"><option value="">Todos los movimientos</option><option *ngFor="let t of ['DEPOSITO','RETIRO','TRANSFERENCIA','PAGO','DESEMBOLSO_PRESTAMO','PAGO_PRESTAMO','REVERSION']" [value]="t">{{t.replaceAll('_',' ')}}</option></select></label><label>Estado<select [(ngModel)]="estado" name="estado"><option value="">Todos los estados</option><option *ngFor="let e of ['PENDIENTE','PROCESANDO','COMPLETADA','FALLIDA','REVERTIDA']" [value]="e">{{e}}</option></select></label><label>Desde<input type="date" [(ngModel)]="desde" name="desde"></label><label>Hasta<input type="date" [(ngModel)]="hasta" name="hasta" [min]="desde"></label></div>
          <p class="filter-validation" role="alert" *ngIf="filtroError">{{filtroError}}</p>
        </form>
      </section>
      <mat-card class="table-card"><table mat-table [dataSource]="transacciones">
        <ng-container matColumnDef="referencia"><th mat-header-cell *matHeaderCellDef>Referencia</th><td mat-cell *matCellDef="let t">{{t.numeroReferencia}}</td></ng-container>
        <ng-container matColumnDef="tipo"><th mat-header-cell *matHeaderCellDef>Tipo</th><td mat-cell *matCellDef="let t">{{t.tipoTransaccion.replaceAll('_',' ')}}</td></ng-container>
        <ng-container matColumnDef="cuenta"><th mat-header-cell *matHeaderCellDef>Cuenta</th><td mat-cell *matCellDef="let t">{{t.numeroCuentaOrigen | cuentaVisible}}</td></ng-container>
        <ng-container matColumnDef="monto"><th mat-header-cell *matHeaderCellDef>Monto</th><td mat-cell *matCellDef="let t">{{t.moneda}} {{t.monto | number:'1.2-2'}}</td></ng-container>
        <ng-container matColumnDef="estado"><th mat-header-cell *matHeaderCellDef>Estado</th><td mat-cell *matCellDef="let t"><span class="status-badge" [ngClass]="'status-'+t.estado?.toLowerCase()">{{t.estado}}</span></td></ng-container>
        <ng-container matColumnDef="fecha"><th mat-header-cell *matHeaderCellDef>Fecha</th><td mat-cell *matCellDef="let t">{{t.fechaTransaccion | date:'dd/MM/yyyy HH:mm'}}</td></ng-container>
        <ng-container matColumnDef="acciones"><th mat-header-cell *matHeaderCellDef>Acciones</th><td mat-cell *matCellDef="let t"><a mat-button color="primary" [routerLink]="['/transacciones',t.id]" [attr.aria-label]="'Ver detalle de '+t.numeroReferencia">Ver detalle</a><button *ngIf="isAdmin && admiteReversion(t)" mat-button color="primary" (click)="confirmarReversion(t)">Revertir</button></td></ng-container>
        <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr><tr mat-row *matRowDef="let row; columns: displayedColumns"></tr><tr *matNoDataRow><td [attr.colspan]="displayedColumns.length" class="filter-no-results">{{loading ? "Cargando..." : errorCarga ? "Consulta no disponible." : "No se encontraron movimientos."}}</td></tr>
      </table><div *ngIf="loading" class="center"><mat-spinner diameter="32"></mat-spinner></div>
      <div role="alert" class="form-feedback" *ngIf="errorCarga">{{errorCarga}} <button mat-button (click)="cargarTransacciones()">Reintentar</button></div>
      <div class="pager" *ngIf="isAdmin && !loading && !errorCarga"><button mat-button [disabled]="page===0" (click)="cambiarPagina(page-1)">Anterior</button><span>Página {{page+1}} de {{totalPages || 1}} · {{totalElements}}</span><button mat-button [disabled]="page+1>=totalPages" (click)="cambiarPagina(page+1)">Siguiente</button></div></mat-card>
    </div>
    <ng-template #transaccionDialog>
      <h2 mat-dialog-title>{{resultadoIncierto ? 'Confirma el resultado' : revisando ? 'Revisa tu operación' : 'Nuevo movimiento'}}</h2>
      <mat-dialog-content class="form">
        <div role="alert" class="form-feedback" *ngIf="formError">{{formError}}</div>
        <ng-container *ngIf="!revisando">
          <p class="form-intro">Selecciona una cuenta e indica el importe. Podrás revisar todo antes de confirmar.</p>
          <p class="form-note" role="status" *ngIf="cargandoCuentas">Actualizando cuentas y saldos…</p>
          <button mat-button type="button" [disabled]="cargandoCuentas || validando" (click)="cargarCuentasFormulario()">Actualizar saldos</button>
          <mat-form-field appearance="outline" subscriptSizing="dynamic"><mat-label>Movimiento</mat-label><mat-select [(ngModel)]="form.tipoTransaccion" [disabled]="validando || cargandoCuentas" (selectionChange)="cambiarMovimiento()"><mat-option value="DEPOSITO">Depositar</mat-option><mat-option value="RETIRO">Retirar</mat-option><mat-option value="TRANSFERENCIA">Transferir</mat-option><mat-option value="PAGO">Realizar un pago</mat-option></mat-select></mat-form-field>
          <mat-form-field appearance="outline" subscriptSizing="dynamic"><mat-label>Cuenta de origen</mat-label><mat-select [(ngModel)]="form.numeroCuentaOrigen" #origenControl="ngModel" required [disabled]="validando || cargandoCuentas" (selectionChange)="seleccionarOrigen()"><mat-option *ngFor="let c of cuentasDisponibles" [value]="c.numeroCuenta">{{c.numeroCuenta}} · {{c.moneda}} {{c.saldo | number:'1.2-2'}}</mat-option></mat-select><mat-hint>Solo cuentas activas.</mat-hint><mat-error *ngIf="origenControl.invalid">Selecciona una cuenta activa.</mat-error></mat-form-field>
          <p class="form-note" *ngIf="!cargandoCuentas && !cuentasDisponibles.length && !formError">No hay cuentas activas disponibles. Abre una cuenta y solicita su activación.</p>
          <p class="form-note" *ngIf="cuentaOrigen" role="status">Saldo disponible: {{cuentaOrigen.moneda}} {{cuentaOrigen.saldo | number:'1.2-2'}}. {{form.tipoTransaccion==='DEPOSITO' ? 'El depósito aumentará este saldo.' : 'El importe se descontará de esta cuenta.'}}</p>
          <mat-form-field appearance="outline" *ngIf="form.tipoTransaccion==='TRANSFERENCIA'"><mat-label>Cuenta de destino</mat-label><input matInput [(ngModel)]="form.numeroCuentaDestino" #destinoControl="ngModel" required [pattern]="patronDestino" [disabled]="validando || cargandoCuentas" placeholder="FT12345678" maxlength="10" autocomplete="off" [matAutocomplete]="destinos" (ngModelChange)="reiniciarRevision()" (blur)="normalizarDestino()"><mat-autocomplete #destinos="matAutocomplete"><mat-option *ngFor="let c of cuentasDestinoDisponibles" [value]="c.numeroCuenta">{{c.numeroCuenta}} · {{c.moneda}}</mat-option></mat-autocomplete><mat-hint>FT + 8 dígitos. Misma moneda.</mat-hint><mat-error *ngIf="destinoControl.invalid">Ingresa FT seguido de 8 dígitos.</mat-error></mat-form-field>
          <p class="form-feedback" role="status" *ngIf="errorDestino">{{errorDestino}}</p>
          <mat-form-field appearance="outline" subscriptSizing="dynamic"><mat-label>Importe {{form.moneda || ''}}</mat-label><input matInput type="number" inputmode="decimal" required min="0.01" [max]="maximoImporte" [pattern]="patronImporte" step="0.01" [(ngModel)]="form.monto" #importeControl="ngModel" [disabled]="validando || cargandoCuentas" (ngModelChange)="reiniciarRevision()"><mat-hint>Mayor a cero y con un máximo de 2 decimales.</mat-hint><mat-error *ngIf="importeControl.hasError('required') || importeControl.hasError('min')">Ingresa un importe mayor a cero.</mat-error><mat-error *ngIf="importeControl.hasError('pattern')">Usa un máximo de 2 decimales.</mat-error><mat-error *ngIf="importeControl.hasError('max')">{{form.tipoTransaccion==='DEPOSITO' ? 'El importe supera el máximo permitido.' : 'El importe supera el saldo disponible.'}}</mat-error></mat-form-field>
          <mat-form-field appearance="outline" subscriptSizing="dynamic"><mat-label>Concepto (opcional)</mat-label><input matInput [(ngModel)]="form.descripcion" maxlength="255" [disabled]="validando || cargandoCuentas" (ngModelChange)="reiniciarRevision()"><mat-hint align="end">{{form.descripcion?.length || 0}}/255</mat-hint></mat-form-field>
        </ng-container>
        <div class="review-summary" *ngIf="revisando">
          <span class="eyebrow">{{form.tipoTransaccion}}</span>
          <strong class="review-amount">{{form.moneda}} {{form.monto | number:'1.2-2'}}</strong>
          <dl><dt>Cuenta de origen</dt><dd>{{form.numeroCuentaOrigen}}</dd><ng-container *ngIf="form.tipoTransaccion==='TRANSFERENCIA'"><dt>Destino</dt><dd>{{form.numeroCuentaDestino}}</dd></ng-container><ng-container *ngIf="revision"><dt>Saldo disponible al revisar</dt><dd>{{form.moneda}} {{revision.saldoDisponible | number:'1.2-2'}}</dd><dt>Saldo estimado después</dt><dd>{{form.moneda}} {{revision.saldoEstimado | number:'1.2-2'}}</dd></ng-container><dt>Concepto</dt><dd>{{form.descripcion || 'Sin concepto'}}</dd></dl>
          <p class="form-note" *ngIf="!resultadoIncierto">Comprueba el importe y las cuentas. El saldo puede cambiar; se validará de nuevo al confirmar.</p><p class="form-note" *ngIf="resultadoIncierto">Se conservarán los datos originales y la clave de operación. Este reintento no crea un segundo movimiento.</p>
        </div>
      </mat-dialog-content>
      <mat-dialog-actions align="end"><button mat-button [disabled]="guardando || validando" (click)="resultadoIncierto ? cerrarModal() : revisando ? volverEditar() : cerrarModal()">{{resultadoIncierto ? 'Continuar después' : revisando ? 'Volver' : 'Cancelar'}}</button><button mat-raised-button color="primary" [disabled]="guardando || validando || (!revisando && (cargandoCuentas || !!errorEdicion))" (click)="revisando ? guardar() : revisarOperacion()">{{guardando ? 'Confirmando…' : validando ? 'Validando…' : resultadoIncierto ? 'Consultar y confirmar resultado' : revisando ? 'Confirmar movimiento' : 'Revisar operación'}}</button></mat-dialog-actions>
    </ng-template>
    <ng-template #confirmDialog><h2 mat-dialog-title>Confirmar reversión</h2><mat-dialog-content>Se creará una nueva transacción compensatoria y la original quedará marcada como revertida. ¿Desea continuar?</mat-dialog-content><mat-dialog-actions align="end"><p class="form-feedback" role="alert" *ngIf="reversionError">{{reversionError}}</p><button mat-button [disabled]="revirtiendo" (click)="cerrarModal()">Cancelar</button><button mat-raised-button color="primary" [disabled]="revirtiendo" (click)="ejecutarReversion()">{{revirtiendo ? 'Confirmando…' : 'Confirmar'}}</button></mat-dialog-actions></ng-template>
  `,
  styles: [`.toolbar,.filters{display:flex;gap:16px;align-items:center;justify-content:space-between;margin-bottom:16px}.filters{justify-content:flex-start;flex-wrap:wrap}.filters mat-form-field{min-width:160px}.table-card{overflow:auto}.center{text-align:center;padding:24px}.pager{display:flex;justify-content:center;gap:18px;padding:16px}.form{display:grid;gap:12px;min-width:0}.status-badge{padding:5px 10px;border-radius:999px;font-size:12px;font-weight:700}.status-completada{background:#dcfce7;color:#166534}.status-fallida{background:#fee2e2;color:#991b1b}.status-revertida{background:#f3e8ff;color:#7e22ce}.status-pendiente{background:#dbeafe;color:#1d4ed8}.status-procesando{background:#fef3c7;color:#92400e}`]
})
export class TransaccionesComponent implements OnInit, OnDestroy {
  errorCarga=''; private consultaLista?:Subscription;
  cargandoCuentas=false;
  private cargaCuentas?:Subscription;
  readonly patronDestino=/^FT\d{8}$/i;
  readonly patronImporte=/^\d+(\.\d{1,2})?$/;
  get cuentaOrigen():Cuenta|undefined {return this.cuentasDisponibles.find(c=>c.numeroCuenta===this.form.numeroCuentaOrigen);}
  get maximoImporte():number {return this.form.tipoTransaccion==='DEPOSITO' ? 9999999999999.99 : Math.min(Number(this.cuentaOrigen?.saldo || 0),9999999999999.99);}
  get cuentasDestinoDisponibles():Cuenta[] {
    const busqueda=(this.form.numeroCuentaDestino || '').trim().toUpperCase();
    return this.cuentasDisponibles.filter(c=>c.numeroCuenta!==this.form.numeroCuentaOrigen && c.moneda===this.form.moneda && c.numeroCuenta?.includes(busqueda));
  }
  get errorDestino():string {
    if(this.form.tipoTransaccion!=='TRANSFERENCIA' || !this.patronDestino.test(this.form.numeroCuentaDestino || ''))return '';
    const destino=this.form.numeroCuentaDestino!.toUpperCase();
    if(destino===this.form.numeroCuentaOrigen)return 'Elige una cuenta de destino diferente a la de origen.';
    const conocida=this.cuentasDisponibles.find(c=>c.numeroCuenta===destino);
    return conocida && conocida.moneda!==this.form.moneda ? 'Las cuentas deben usar la misma moneda. No hay conversión automática.' : '';
  }
  get errorEdicion():string {
    if(!this.cuentaOrigen || this.cuentaOrigen.estado!=='ACTIVA')return 'Selecciona una cuenta activa.';
    if(!importeValido(this.form.monto) || !this.patronImporte.test(String(this.form.monto)))return 'Ingresa un importe mayor a cero, con hasta 2 decimales.';
    if(this.form.monto>this.maximoImporte)return 'El importe supera el saldo disponible de la cuenta.';
    if(this.form.tipoTransaccion==='TRANSFERENCIA')return errorTransferencia(this.form.numeroCuentaOrigen,this.form.numeroCuentaDestino) || this.errorDestino;
    return '';
  }
  masFiltros=false; filtroError='';
  get filtrosActivos():number {return [this.numeroCuenta.trim(),this.tipo,this.estado,this.desde,this.hasta].filter(Boolean).length;}
  aplicarFiltros():void {this.filtroError='';if(this.desde && this.hasta && this.desde>this.hasta){this.filtroError='La fecha inicial debe ser anterior a la fecha final.';return;}this.page=0;this.cargarTransacciones();}
  limpiarFiltros():void {this.numeroCuenta='';this.tipo='';this.estado='';this.desde='';this.hasta='';this.filtroError='';this.masFiltros=false;this.page=0;this.cargarTransacciones();}

  transacciones: Transaccion[] = []; misCuentas: Cuenta[] = []; loading = true; guardando = false;
  revisando=false; validando=false; formError=''; cuentasDisponibles: Cuenta[]=[];
  revision:RevisionMovimiento|null=null;resultadoIncierto=false;tienePendiente=false;revirtiendo=false;reversionError='';
  admiteReversion=admiteReversion;
  operacionId:string = crypto.randomUUID();
  page = 0; size = 10; totalPages = 0; totalElements = 0; tipo = ''; estado = ''; numeroCuenta = ''; desde = ''; hasta = '';
  dialogRef: MatDialogRef<unknown> | null = null; form: Transaccion = this.formVacio(); transaccionPendiente: Transaccion | null = null;
  @ViewChild('transaccionDialog') transaccionDialogTpl!: TemplateRef<unknown>;
  @ViewChild('confirmDialog') confirmDialogTpl!: TemplateRef<unknown>;
  get isAdmin(): boolean { return this.auth.getSession()?.rol === 'ADMIN'; }
  get usuarioId(): number { return this.auth.getSession()!.usuarioId; }
  get displayedColumns(): string[] { return ['referencia','tipo','cuenta','monto','estado','fecha','acciones']; }
  constructor(private transaccionSvc: TransaccionService, private cuentaSvc: CuentaService, private auth: AuthService, private dialog: MatDialog, private snack: MatSnackBar, private pendientes:MovimientoPendienteService, private router:Router) {}
  ngOnInit(): void {
    this.tienePendiente=!!this.pendientes.leer();
    this.cargarTransacciones();
  }
  cargarTransacciones(): void {
    this.consultaLista?.unsubscribe();this.loading=true;this.errorCarga='';this.transacciones=[];
    const error=()=>{this.loading=false;this.totalPages=0;this.totalElements=0;this.errorCarga='No pudimos cargar los movimientos. Intenta nuevamente.';};
    if(!this.isAdmin){
      this.consultaLista=this.cuentaSvc.getByUsuario(this.usuarioId).pipe(
        switchMap(cuentas=>{this.misCuentas=cuentas;return cuentas.length ? forkJoin(cuentas.map(c=>this.transaccionSvc.getByCuenta(c.id!))) : of([] as Transaccion[][]);}),
        timeout(15000)
      ).subscribe({next:grupos=>{
        const mapa=new Map<number,Transaccion>();grupos.flat().forEach(t=>mapa.set(t.id!,t));
        this.transacciones=[...mapa.values()].sort((a,b)=>new Date(b.fechaTransaccion||0).getTime()-new Date(a.fechaTransaccion||0).getTime());this.loading=false;
      },error});return;
    }
    this.consultaLista=this.transaccionSvc.getPage(this.page,this.size,this.tipo,this.estado,this.numeroCuenta,this.desde,this.hasta).pipe(timeout(15000)).subscribe({next:p=>{
      if(this.page>0 && this.page>=p.totalPages){this.page=Math.max(0,p.totalPages-1);this.cargarTransacciones();return;}
      this.transacciones=p.content;this.totalPages=p.totalPages;this.totalElements=p.totalElements;this.loading=false;
    },error});
  }
  cambiarPagina(p:number):void { this.page=p; this.cargarTransacciones(); }
  abrirModal():void {
    if(this.dialogRef?.getState()===MatDialogState.OPEN)return;
    const pendiente=this.pendientes.leer();
    this.resultadoIncierto=!!pendiente;this.tienePendiente=!!pendiente;
    this.operacionId=pendiente?.operacionId || crypto.randomUUID();
    this.form=pendiente?.movimiento || this.formVacio();this.revisando=!!pendiente;this.revision=null;
    this.formError=pendiente ? 'Retoma esta operación para consultar y confirmar su resultado.' : '';this.cuentasDisponibles=[];
    this.cargarCuentasFormulario();
    this.dialogRef=this.dialog.open(this.transaccionDialogTpl,{width:'540px',maxWidth:'94vw',disableClose:true});
  }
  cargarCuentasFormulario():void {
    if(this.validando || this.guardando)return;
    this.cargaCuentas?.unsubscribe();this.cargandoCuentas=true;
    if(!this.resultadoIncierto)this.reiniciarRevision();
    const cuentas=this.isAdmin ? this.cuentaSvc.getPage(0,200,undefined,'ACTIVA').pipe(map(p=>p.content)) : this.cuentaSvc.getByUsuario(this.usuarioId);
    this.cargaCuentas=cuentas.pipe(timeout(10000)).subscribe({next:r=>{
      this.cargandoCuentas=false;this.cuentasDisponibles=r.filter(c=>c.estado==='ACTIVA');
      if(!this.resultadoIncierto)this.seleccionarOrigen();
    },error:()=>{this.cargandoCuentas=false;if(!this.resultadoIncierto){this.cuentasDisponibles=[];this.formError='No pudimos cargar las cuentas. Usa Actualizar saldos para reintentar.';}}});
  }
  reiniciarRevision():void {if(this.resultadoIncierto)return;this.revisando=false;this.revision=null;this.formError='';}
  cambiarMovimiento():void {this.reiniciarRevision();if(this.form.tipoTransaccion!=='TRANSFERENCIA')this.form.numeroCuentaDestino=undefined;}
  normalizarDestino():void {if(!this.resultadoIncierto)this.form.numeroCuentaDestino=this.form.numeroCuentaDestino?.trim().toUpperCase();}
  seleccionarOrigen():void {
    this.reiniciarRevision();const c=this.cuentasDisponibles.find(c=>c.numeroCuenta===this.form.numeroCuentaOrigen);
    this.form.moneda=c?.moneda;this.form.cuentaOrigenId=c?.id || 0;
  }
  volverEditar():void {if(this.resultadoIncierto)return;this.revisando=false;this.revision=null;this.formError='';}
  revisarOperacion():void {
    if(this.validando||this.guardando||this.cargandoCuentas||this.resultadoIncierto)return;
    this.formError='';
    this.normalizarDestino();
    this.formError=this.errorEdicion;if(this.formError)return;
    if(this.form.tipoTransaccion==='TRANSFERENCIA') {
      this.formError=errorTransferencia(this.form.numeroCuentaOrigen,this.form.numeroCuentaDestino);
      if(this.formError) return;
      this.form.numeroCuentaDestino=this.form.numeroCuentaDestino!.trim().toUpperCase();
    } else this.form.numeroCuentaDestino=undefined;
    const cuenta=this.cuentaOrigen!;
    this.form.cuentaOrigenId=cuenta.id!;this.form.moneda=cuenta.moneda;
    const solicitud=JSON.stringify(this.form);this.validando=true;
    this.transaccionSvc.revisar({...this.form}).subscribe({next:r=>{
      this.validando=false;if(JSON.stringify(this.form)!==solicitud)return;
      this.revision=r;this.revisando=true;
    },error:e=>{this.validando=false;if(JSON.stringify(this.form)!==solicitud)return;this.formError=e.error?.message||(e.name==='TimeoutError' ? 'La revisión tardó demasiado. No se envió ningún movimiento; puedes reintentar.' : 'No pudimos validar las cuentas. Revisa los datos e intenta nuevamente.');}});
  }
  guardar():void {
    if(this.guardando || !this.revisando) return;
    const reintentando=this.resultadoIncierto;
    this.guardando=true;this.formError='';
    try{this.pendientes.guardar(this.operacionId,this.form);this.tienePendiente=true;}
    catch{this.guardando=false;this.formError='No pudimos conservar la operación en este navegador. No se envió el movimiento.';return;}
    this.resultadoIncierto=true;
    this.transaccionSvc.create({...this.form},this.operacionId).subscribe({
      next:r=>{
        this.guardando=false;
        if(!['COMPLETADA','REVERTIDA','FALLIDA','CANCELADA'].includes(r.estado||'')){this.formError='El resultado todavía está pendiente. Consulta de nuevo conservando esta operación.';return;}
        this.pendientes.limpiar();this.tienePendiente=false;this.resultadoIncierto=false;
        this.cerrarModal();this.router.navigate(['/transacciones',r.id]);
      },
      error:e=>{
        this.guardando=false;
        const mensaje=e.error?.message || 'No pudimos confirmar el resultado.';
        const rechazo=e.status===409 && /fue rechazada|Movimiento rechazado/.test(mensaje);
        if((!reintentando && [400,403,404,422].includes(e.status))||rechazo){
          this.pendientes.limpiar();this.tienePendiente=false;this.resultadoIncierto=false;
          this.revisando=false;this.revision=null;this.operacionId=crypto.randomUUID();this.formError=mensaje;this.cargarTransacciones();
        }else this.formError=mensaje+' Retoma el mismo movimiento para confirmar el resultado; no cambies sus datos.';
      }
    });
  }
  confirmarReversion(t:Transaccion):void {
    if(!this.isAdmin||!admiteReversion(t))return;
    this.transaccionPendiente=t;this.reversionError='';this.dialogRef=this.dialog.open(this.confirmDialogTpl,{width:'min(92vw,500px)',disableClose:true});
  }
  ejecutarReversion():void {
    if(!this.transaccionPendiente||this.revirtiendo)return;
    const id=this.transaccionPendiente.id!;this.revirtiendo=true;this.reversionError='';
    this.transaccionSvc.revertir(id).subscribe({next:r=>{this.revirtiendo=false;this.cerrarModal();this.transaccionPendiente=null;this.router.navigate(['/transacciones',r.id]);},error:e=>{this.revirtiendo=false;this.reversionError=e.error?.message || 'No pudimos confirmar la reversión. Reintenta sobre este mismo movimiento.';}});
  }
  cerrarModal():void {if(this.guardando || this.validando || this.revirtiendo)return;this.cargaCuentas?.unsubscribe();this.cargandoCuentas=false;this.dialogRef?.close();this.dialogRef=null;}
  ngOnDestroy():void {this.consultaLista?.unsubscribe();this.cargaCuentas?.unsubscribe();this.dialogRef?.close();}
  private formVacio():Transaccion { return {cuentaOrigenId:0,numeroCuentaOrigen:'',tipoTransaccion:'DEPOSITO',monto:0,moneda:undefined,descripcion:'',numeroCuentaDestino:''}; }
}
