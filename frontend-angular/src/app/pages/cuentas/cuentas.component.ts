import { importeValido } from '../../models/form-rules';
import { AperturaPendienteService } from '../../services/apertura-pendiente.service';
import { Subscription, timeout } from 'rxjs';
import { Component, OnInit, OnDestroy, TemplateRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';
import { CuentaService } from '../../services/cuenta.service';
import { UsuarioService } from '../../services/usuario.service';
import { AuthService } from '../../services/auth.service';
import { Cuenta, Usuario } from '../../models/models';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTableModule } from '@angular/material/table';
import { MatMenuModule } from '@angular/material/menu';
import { ActivatedRoute } from '@angular/router';

type AccionCuenta = 'activar' | 'bloquear' | 'congelar' | 'desbloquear' | 'cerrar';

@Component({
  selector: 'app-cuentas',
  standalone: true,
  imports: [CommonModule, FormsModule, MatButtonModule, MatCardModule, MatDialogModule,
    MatFormFieldModule, MatIconModule, MatInputModule, MatProgressSpinnerModule,
    MatSelectModule, MatSnackBarModule, MatTableModule, MatMenuModule],
  template: `
    <div class="page-container">
      <mat-card class="card toolbar"><div><h1>{{isAdmin ? 'Gestión de Cuentas' : 'Mis Cuentas'}}</h1><p>Consulta y administra cuentas bancarias.</p></div>
        <button mat-raised-button color="primary" (click)="abrirModal()">{{tieneAperturaPendiente ? 'Retomar apertura' : 'Nueva cuenta'}}</button></mat-card>
      <section class="filter-shell" *ngIf="isAdmin" aria-label="Filtros de cuentas">
        <form (ngSubmit)="aplicarFiltros()">
          <div class="filter-line"><label class="filter-search"><mat-icon>search</mat-icon><input aria-label="Buscar cuenta" placeholder="Buscar por número de cuenta" [(ngModel)]="numeroCuenta" name="numeroCuenta"></label>
            <button class="filter-toggle" type="button" (click)="masFiltros=!masFiltros" [attr.aria-expanded]="masFiltros" aria-controls="advanced-cuentas"><mat-icon>tune</mat-icon>Más filtros<span class="filter-count" *ngIf="filtrosActivos">{{filtrosActivos}}</span></button>
            <button class="filter-apply" type="submit">Buscar</button>
            <button class="filter-clear" type="button" *ngIf="filtrosActivos" (click)="limpiarFiltros()">Limpiar</button>
          </div>
          <div class="filter-details" id="advanced-cuentas" *ngIf="masFiltros"><label>Moneda<select [(ngModel)]="moneda" name="moneda"><option value="">Todas las monedas</option><option value="PEN">Soles · PEN</option><option value="USD">Dólares · USD</option></select></label><label>Estado<select [(ngModel)]="estado" name="estado"><option value="">Todos los estados</option><option *ngFor="let e of ['PENDIENTE_VERIFICACION','ACTIVA','BLOQUEADA','CONGELADA','INACTIVA','CERRADA']" [value]="e">{{estadoTexto(e)}}</option></select></label></div>
          <p class="filter-validation" role="alert" *ngIf="filtroError">{{filtroError}}</p>
        </form>
      </section>
      <mat-card class="card table-card"><table mat-table [dataSource]="cuentas">
        <ng-container matColumnDef="numero"><th mat-header-cell *matHeaderCellDef>Número</th><td mat-cell *matCellDef="let c">{{c.numeroCuenta}}</td></ng-container>
        <ng-container matColumnDef="usuario"><th mat-header-cell *matHeaderCellDef>Usuario</th><td mat-cell *matCellDef="let c">{{c.usuarioId}}</td></ng-container>
        <ng-container matColumnDef="tipo"><th mat-header-cell *matHeaderCellDef>Tipo</th><td mat-cell *matCellDef="let c">{{c.tipoCuenta}}</td></ng-container>
        <ng-container matColumnDef="saldo"><th mat-header-cell *matHeaderCellDef>Saldo</th><td mat-cell *matCellDef="let c">{{c.moneda}} {{c.saldo | number:'1.2-2'}}</td></ng-container>
        <ng-container matColumnDef="estado"><th mat-header-cell *matHeaderCellDef>Estado</th><td mat-cell *matCellDef="let c"><span class="status-badge" [ngClass]="'status-' + c.estado?.toLowerCase()">{{estadoTexto(c.estado)}}</span></td></ng-container>
        <ng-container matColumnDef="acciones"><th mat-header-cell *matHeaderCellDef>Acciones</th><td mat-cell *matCellDef="let c">
          <button mat-icon-button [attr.aria-label]="'Opciones de cuenta '+c.numeroCuenta" [matMenuTriggerFor]="accionesMenu" *ngIf="isAdmin && c.estado!=='CERRADA'" [disabled]="cambiandoEstado || guardando"><mat-icon>more_vert</mat-icon></button>
          <mat-menu #accionesMenu="matMenu">
            <button mat-menu-item *ngIf="c.estado === 'PENDIENTE_VERIFICACION' || c.estado === 'INACTIVA'" (click)="activar(c)"><mat-icon>check_circle</mat-icon>Activar</button>
            <button mat-menu-item *ngIf="c.estado === 'ACTIVA' || c.estado === 'INACTIVA'" (click)="bloquear(c)"><mat-icon>block</mat-icon>Bloquear</button>
            <button mat-menu-item *ngIf="c.estado === 'ACTIVA' || c.estado === 'INACTIVA'" (click)="congelar(c)"><mat-icon>ac_unit</mat-icon>Congelar</button>
            <button mat-menu-item *ngIf="c.estado === 'BLOQUEADA' || c.estado === 'CONGELADA'" (click)="desbloquear(c)"><mat-icon>lock_open</mat-icon>Desbloquear</button>
            <button mat-menu-item *ngIf="c.estado !== 'CERRADA'" (click)="cerrarCuenta(c)"><mat-icon>close</mat-icon>Cerrar cuenta</button>
          </mat-menu>
        </td></ng-container>
        <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr><tr mat-row *matRowDef="let row; columns: displayedColumns"></tr><tr *matNoDataRow><td [attr.colspan]="displayedColumns.length" class="filter-no-results">{{loading ? "Cargando..." : errorCarga ? "Consulta no disponible." : "No se encontraron cuentas. Prueba con otros filtros."}}</td></tr>
      </table><div role="alert" class="form-feedback" *ngIf="errorCarga">{{errorCarga}} <button mat-button (click)="cargarCuentas()">Reintentar</button></div><div *ngIf="loading" class="center"><mat-spinner diameter="32"></mat-spinner></div><div class="pager" *ngIf="isAdmin && !loading && !errorCarga">
        <button mat-button [disabled]="page===0" (click)="cambiarPagina(page-1)">Anterior</button><span>Página {{page+1}} de {{totalPages || 1}} · {{totalElements}} cuentas</span><button mat-button [disabled]="page+1>=totalPages" (click)="cambiarPagina(page+1)">Siguiente</button>
      </div></mat-card>
    </div>
    <ng-template #cuentaDialog>
      <form #cuentaForm="ngForm" (ngSubmit)="guardar(cuentaForm)">
        <h2 mat-dialog-title>{{revisandoApertura ? 'Revisa la apertura' : 'Abrir una cuenta'}}</h2>
        <mat-dialog-content class="form">
          <p class="form-intro">La cuenta quedará pendiente de activación.</p>
          <div class="form-feedback" role="alert" *ngIf="formError">{{formError}}</div>
          <ng-container *ngIf="!revisandoApertura">
          <button mat-button type="button" *ngIf="isAdmin" [disabled]="cargandoTitulares" (click)="cargarUsuarios()">{{cargandoTitulares ? 'Cargando titulares…' : 'Actualizar titulares'}}</button>
          <mat-form-field appearance="outline" floatLabel="always" subscriptSizing="dynamic" *ngIf="isAdmin"><mat-label>Titular</mat-label>
            <mat-select [(ngModel)]="form.usuarioId" name="usuarioId" required #titular="ngModel" [disabled]="cargandoTitulares">
              <mat-option *ngFor="let u of usuarios" [value]="u.id">{{u.nombre}} {{u.apellido}} · {{u.email}}</mat-option>
            </mat-select><mat-error>Selecciona un cliente activo.</mat-error>
          </mat-form-field>
          <mat-form-field appearance="outline" floatLabel="always" subscriptSizing="dynamic"><mat-label>Tipo de cuenta</mat-label><mat-select [(ngModel)]="form.tipoCuenta" name="tipoCuenta" required><mat-option value="AHORROS">Ahorros</mat-option><mat-option value="CORRIENTE">Corriente</mat-option><mat-option value="PLAZO_FIJO">Plazo fijo</mat-option></mat-select></mat-form-field>
          <mat-form-field appearance="outline" floatLabel="always" subscriptSizing="dynamic"><mat-label>Moneda</mat-label><mat-select [(ngModel)]="form.moneda" name="moneda" required><mat-option value="PEN">Soles · PEN</mat-option><mat-option value="USD">Dólares · USD</mat-option></mat-select></mat-form-field>
          <mat-form-field appearance="outline" floatLabel="always" subscriptSizing="dynamic" *ngIf="isAdmin"><mat-label>Saldo inicial</mat-label><input matInput type="number" inputmode="decimal" required min="0" max="9999999999999.99" step="0.01" [pattern]="patronImporte" [(ngModel)]="form.saldoInicial" name="saldoInicial" #saldoControl="ngModel"><mat-hint>Importe de demostración. Hasta 2 decimales.</mat-hint><mat-error *ngIf="saldoControl.invalid">Usa un saldo desde cero, con hasta 2 decimales y dentro del máximo permitido.</mat-error></mat-form-field>
          <p class="form-note" *ngIf="!isAdmin">Tu cuenta se abrirá con saldo cero.</p>
          </ng-container>
          <div class="review-summary" *ngIf="revisandoApertura">
            <dl><dt>Titular</dt><dd>{{titularApertura}}</dd><dt>Tipo</dt><dd>{{form.tipoCuenta.replaceAll('_',' ')}}</dd><dt>Moneda</dt><dd>{{form.moneda}}</dd><dt>Saldo inicial</dt><dd>{{form.moneda}} {{form.saldoInicial | number:'1.2-2'}}</dd><dt>Estado inicial</dt><dd>Pendiente de verificación</dd></dl>
            <p class="form-note" *ngIf="resultadoAperturaIncierto">La apertura conserva sus datos y su clave. Consulta el resultado antes de iniciar otra.</p>
          </div>
        </mat-dialog-content>
        <mat-dialog-actions align="end"><button mat-button type="button" [disabled]="guardando" (click)="resultadoAperturaIncierto || !revisandoApertura ? cerrarModal() : volverApertura()">{{resultadoAperturaIncierto ? 'Continuar después' : revisandoApertura ? 'Volver' : 'Cancelar'}}</button><button mat-raised-button color="primary" type="submit" [disabled]="guardando || (!revisandoApertura && (cuentaForm.invalid || !aperturaValida || cargandoTitulares))">{{guardando ? 'Confirmando…' : resultadoAperturaIncierto ? 'Consultar resultado' : revisandoApertura ? 'Confirmar apertura' : 'Revisar apertura'}}</button></mat-dialog-actions>
      </form>
    </ng-template>
    <ng-template #motivoDialog><h2 mat-dialog-title>{{tituloEstado}}</h2>
      <mat-dialog-content class="form">
        <p class="form-intro">Cuenta {{cuentaPendiente?.numeroCuenta}} · {{cuentaPendiente?.moneda}} {{cuentaPendiente?.saldo | number:'1.2-2'}}</p>
        <p class="form-note">{{descripcionEstado}}</p>
        <p class="form-feedback" role="alert" *ngIf="errorEstadoCuenta">{{errorEstadoCuenta}}</p>
        <mat-form-field appearance="outline" floatLabel="always" subscriptSizing="dynamic" *ngIf="requiereMotivo"><mat-label>Motivo</mat-label><textarea matInput [(ngModel)]="motivo" [disabled]="cambiandoEstado" rows="4" required minlength="5" maxlength="500" #motivoControl="ngModel"></textarea><mat-hint>De 5 a 500 caracteres.</mat-hint><mat-error *ngIf="motivoControl.invalid">Explica el motivo con al menos 5 caracteres.</mat-error></mat-form-field>
      </mat-dialog-content>
      <mat-dialog-actions align="end"><button mat-button [disabled]="cambiandoEstado" (click)="cerrarModal()">Cancelar</button><button mat-raised-button color="primary" (click)="confirmarEstado()" [disabled]="cambiandoEstado || (requiereMotivo && motivo.trim().length < 5) || (accionPendiente==='cerrar' && cuentaPendiente?.saldo!==0)">{{cambiandoEstado ? 'Confirmando…' : 'Confirmar cambio'}}</button></mat-dialog-actions>
    </ng-template>
  `,
  styles: [`.toolbar,.filters{display:flex;gap:16px;align-items:center;justify-content:space-between;margin-bottom:16px}.filters{justify-content:flex-start;flex-wrap:wrap}.filters mat-form-field{min-width:200px}.table-card{overflow:auto}.center{text-align:center;padding:24px}.pager{display:flex;justify-content:center;align-items:center;gap:18px;padding:16px}.form{display:grid;gap:12px;min-width:0}.status-badge{display:inline-flex;padding:5px 10px;border-radius:999px;font-size:12px;font-weight:700;text-transform:capitalize}.status-activa{background:#dcfce7;color:#166534}.status-bloqueada{background:#fee2e2;color:#991b1b}.status-congelada{background:#ffedd5;color:#9a3412}.status-cerrada{background:#e5e7eb;color:#374151}.status-pendiente_verificacion{background:#e0e7ff;color:#3730a3}.status-inactiva{background:#f3f4f6;color:#4b5563}`]
})
export class CuentasComponent implements OnInit, OnDestroy {
  errorCarga=''; private consultaLista?:Subscription;
  readonly patronImporte = /^\d+(\.\d{1,2})?$/;
  revisandoApertura=false;
  resultadoAperturaIncierto=false;
  tieneAperturaPendiente=false;
  cargandoTitulares=false;
  cambiandoEstado=false;
  errorEstadoCuenta='';
  aperturaId:string=crypto.randomUUID();
  private cargaTitulares?:Subscription;
  private parametros?:Subscription;
  private autoAbrir?:ReturnType<typeof setTimeout>;
  get aperturaValida():boolean {
    return this.form.usuarioId>0 && ['AHORROS','CORRIENTE','PLAZO_FIJO'].includes(this.form.tipoCuenta)
      && ['PEN','USD'].includes(this.form.moneda || '') && importeValido(this.form.saldoInicial,0)
      && this.patronImporte.test(String(this.form.saldoInicial));
  }
  get titularApertura():string {
    const titular=this.usuarios.find(u=>u.id===this.form.usuarioId);
    if(titular)return `${titular.nombre} ${titular.apellido}`;
    const sesion=this.auth.getSession();
    const nombre=sesion?.usuarioId===this.form.usuarioId ? [sesion.nombre,sesion.apellido].filter(Boolean).join(' ') : '';
    return nombre || `Titular #${this.form.usuarioId}`;
  }
  get requiereMotivo():boolean {return this.accionPendiente==='bloquear' || this.accionPendiente==='congelar';}
  get tituloEstado():string {
    const titulos={activar:'Activar cuenta',bloquear:'Bloquear cuenta',congelar:'Congelar cuenta',desbloquear:'Desbloquear cuenta',cerrar:'Cerrar cuenta'};
    return this.accionPendiente ? titulos[this.accionPendiente] : '';
  }
  get descripcionEstado():string {
    if (this.accionPendiente==='cerrar') return Number(this.cuentaPendiente?.saldo)!==0
      ? 'Para cerrar esta cuenta, su saldo debe ser cero. Revisa sus movimientos antes de continuar.'
      : 'El cierre requiere saldo cero y ausencia de préstamos u obligaciones pendientes. Se conservará el historial.';
    return this.requiereMotivo ? 'La cuenta dejará de admitir débitos. El motivo quedará registrado en la auditoría.' : 'La cuenta quedará activa y podrá realizar operaciones.';
  }
  masFiltros=false; filtroError='';
  get filtrosActivos():number {return [this.numeroCuenta.trim(),this.moneda,this.estado].filter(Boolean).length;}
  aplicarFiltros():void {this.filtroError='';this.page=0;this.cargarCuentas();}
  limpiarFiltros():void {this.numeroCuenta='';this.moneda='';this.estado='';this.filtroError='';this.masFiltros=false;this.page=0;this.cargarCuentas();}

  cuentas: Cuenta[] = []; usuarios: Usuario[] = []; loading = true; modoEdicion = false; guardando = false; editandoId: number | null = null;
  page = 0; size = 10; totalPages = 0; totalElements = 0; moneda = ''; estado = ''; numeroCuenta = ''; form: Cuenta = this.formVacio();
  dialogRef: MatDialogRef<unknown> | null = null; @ViewChild('cuentaDialog') cuentaDialogTpl!: TemplateRef<unknown>; @ViewChild('motivoDialog') motivoDialogTpl!: TemplateRef<unknown>;
  get isAdmin(): boolean { return this.auth.getSession()?.rol === 'ADMIN'; }
  get usuarioId(): number { return this.auth.getSession()!.usuarioId; }
  get displayedColumns(): string[] { return this.isAdmin ? ['numero','usuario','tipo','saldo','estado','acciones'] : ['numero','tipo','saldo','estado']; }
  requestedUsuarioId: number | null = null;
  constructor(private cuentaSvc: CuentaService, private usuarioSvc: UsuarioService, private auth: AuthService, private dialog: MatDialog, private snack: MatSnackBar, private route: ActivatedRoute, private aperturas:AperturaPendienteService) {}
  ngOnInit(): void {
    this.tieneAperturaPendiente=!!this.aperturas.leer();
    this.parametros=this.route.queryParams.subscribe(params => {
      const id=Number(params['usuarioId']);
      this.requestedUsuarioId=Number.isInteger(id) && id>0 ? id : null;
      if (this.isAdmin && this.requestedUsuarioId) this.autoAbrir=setTimeout(() => this.abrirModal());
    });
    if (this.isAdmin) this.cargarUsuarios(); this.cargarCuentas();
  }
  cargarUsuarios(): void {
    if(this.guardando || this.resultadoAperturaIncierto)return;
    this.cargaTitulares?.unsubscribe();this.cargandoTitulares=true;this.formError='';
    this.cargaTitulares=this.usuarioSvc.getPage(0,200,'CLIENTE',true).pipe(timeout(10000)).subscribe({
      next:p=>{this.usuarios=p.content;this.cargandoTitulares=false;},
      error:()=>{this.cargandoTitulares=false;this.formError='No pudimos cargar titulares. Usa Actualizar titulares para reintentar.';}
    });
  }
  cargarCuentas(): void {
    this.consultaLista?.unsubscribe();this.loading=true;this.errorCarga='';this.cuentas=[];
    const error=()=>{this.loading=false;this.totalPages=0;this.totalElements=0;this.errorCarga='No pudimos cargar las cuentas. Intenta nuevamente.';};
    if (!this.isAdmin) { this.consultaLista=this.cuentaSvc.getByUsuario(this.usuarioId).pipe(timeout(15000)).subscribe({next:c=>{this.cuentas=c;this.loading=false;},error}); return; }
    this.consultaLista=this.cuentaSvc.getPage(this.page,this.size,this.moneda,this.estado,this.numeroCuenta).pipe(timeout(15000)).subscribe({next:p=>{
      if(this.page>0 && this.page>=p.totalPages){this.page=Math.max(0,p.totalPages-1);this.cargarCuentas();return;}
      this.cuentas=p.content;this.totalPages=p.totalPages;this.totalElements=p.totalElements;this.loading=false;
    },error});
  }
  cambiarPagina(p: number): void { this.page=p; this.cargarCuentas(); }
  formError = '';
  motivo = ''; accionPendiente: AccionCuenta | null = null; cuentaPendiente: Cuenta | null = null;
  abrirModal(): void {
    if(this.dialogRef || this.guardando || this.cambiandoEstado)return;
    const pendiente=this.aperturas.leer();
    this.resultadoAperturaIncierto=!!pendiente;this.tieneAperturaPendiente=!!pendiente;this.revisandoApertura=!!pendiente;
    this.aperturaId=pendiente?.clave || crypto.randomUUID();this.form=pendiente?.cuenta || this.formVacio();this.formError='';
    if(!pendiente && this.isAdmin && this.requestedUsuarioId)this.form.usuarioId=this.requestedUsuarioId;
    this.abrirDialogo(this.cuentaDialogTpl);
  }
  volverApertura():void {if(!this.guardando && !this.resultadoAperturaIncierto){this.revisandoApertura=false;this.formError='';}}
  guardar(formulario?: NgForm): void {
    if(this.guardando) return;
    this.formError=''; formulario?.form.markAllAsTouched();
    if(!this.resultadoAperturaIncierto && (formulario?.invalid || !this.aperturaValida || this.cargandoTitulares)) {
      this.formError='Selecciona un titular y revisa el saldo: debe ser positivo o cero, con hasta 2 decimales.'; return;
    }
    if(!this.isAdmin) { this.form.usuarioId=this.usuarioId;this.form.saldoInicial=0; }
    if(!this.revisandoApertura){this.revisandoApertura=true;return;}
    const reintentando=this.resultadoAperturaIncierto;
    try{this.aperturas.guardar(this.aperturaId,this.form);}
    catch{this.formError='No pudimos conservar la apertura en este navegador. Intenta nuevamente.';return;}
    this.tieneAperturaPendiente=true;this.resultadoAperturaIncierto=true;
    this.guardando=true;
    this.cuentaSvc.create({...this.form},this.aperturaId).subscribe({
      next:cuenta=>{this.guardando=false;this.aperturas.limpiar();this.tieneAperturaPendiente=false;this.resultadoAperturaIncierto=false;this.cerrarModal();this.cargarCuentas();this.snack.open(`Cuenta ${cuenta.numeroCuenta}. Estado: ${this.estadoTexto(cuenta.estado)}.`,'Cerrar',{duration:4500})},
      error:e=>{
        this.guardando=false;
        if(!reintentando && [400,403,404,422].includes(e.status)){
          this.aperturas.limpiar();this.tieneAperturaPendiente=false;this.resultadoAperturaIncierto=false;this.revisandoApertura=false;this.aperturaId=crypto.randomUUID();
        }
        this.formError=e.error?.message || 'No pudimos confirmar el resultado. Retoma esta apertura con los mismos datos.';
      }
    });
  }

  activar(c:Cuenta):void {this.prepararEstado(c,'activar');}
  bloquear(c:Cuenta):void {this.prepararEstado(c,'bloquear');}
  congelar(c:Cuenta):void {this.prepararEstado(c,'congelar');}
  desbloquear(c:Cuenta):void {this.prepararEstado(c,'desbloquear');}
  cerrarCuenta(c:Cuenta):void {this.prepararEstado(c,'cerrar');}
  estadoTexto(estado?:string):string {return estado ? estado.replaceAll('_',' ') : '—';}

  private prepararEstado(cuenta:Cuenta,accion:AccionCuenta):void {
    if(!this.isAdmin || this.dialogRef || this.cambiandoEstado || cuenta.estado==='CERRADA')return;
    this.cuentaPendiente={...cuenta};this.accionPendiente=accion;this.motivo='';this.errorEstadoCuenta='';
    this.abrirDialogo(this.motivoDialogTpl);
  }
  confirmarEstado():void {
    if(!this.isAdmin || !this.cuentaPendiente?.id || !this.accionPendiente || this.cambiandoEstado)return;
    if(this.requiereMotivo && (this.motivo.trim().length<5 || this.motivo.trim().length>500))return;
    if(this.accionPendiente==='cerrar' && Number(this.cuentaPendiente.saldo)!==0)return;
    const id=this.cuentaPendiente.id;
    const acciones={
      activar:()=>this.cuentaSvc.activar(id),
      bloquear:()=>this.cuentaSvc.bloquear(id,this.motivo.trim()),
      congelar:()=>this.cuentaSvc.congelar(id,this.motivo.trim()),
      desbloquear:()=>this.cuentaSvc.desbloquear(id),
      cerrar:()=>this.cuentaSvc.cerrar(id)
    };
    this.cambiandoEstado=true;this.errorEstadoCuenta='';
    acciones[this.accionPendiente]().pipe(timeout(15000)).subscribe({
      next:cuenta=>{
        this.cambiandoEstado=false;this.cerrarModal();this.cargarCuentas();
        this.snack.open(`Cuenta ${cuenta.numeroCuenta}: ${this.estadoTexto(cuenta.estado)}.`,'Cerrar',{duration:3500});
      },
      error:e=>{
        this.cambiandoEstado=false;
        this.errorEstadoCuenta=e.error?.message || 'No pudimos confirmar el cambio. Puedes reintentar sobre esta misma cuenta.';
        this.cargarCuentas();
      }
    });
  }
  cerrarModal():void {
    if(this.guardando || this.cambiandoEstado)return;
    this.dialogRef?.close();this.dialogRef=null;
  }
  private abrirDialogo(template:TemplateRef<unknown>):void {
    this.dialogRef=this.dialog.open(template,{width:'650px',maxWidth:'94vw',disableClose:true});
  }
  ngOnDestroy():void {
    this.consultaLista?.unsubscribe();
    this.cargaTitulares?.unsubscribe();this.parametros?.unsubscribe();clearTimeout(this.autoAbrir);this.dialogRef?.close();
  }
  private formVacio():Cuenta { return {usuarioId:this.isAdmin ? 0 : this.usuarioId,tipoCuenta:'AHORROS',saldoInicial:0,moneda:'PEN',estado:'PENDIENTE_VERIFICACION'}; }
}
