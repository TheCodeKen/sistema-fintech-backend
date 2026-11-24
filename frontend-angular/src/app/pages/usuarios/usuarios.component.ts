import { ConfirmationDialogComponent } from '../../components/confirmation-dialog.component';
import { emailValido } from '../../models/form-rules';
import { Component, OnInit, OnDestroy, TemplateRef, ViewChild } from '@angular/core';
import { firstValueFrom, Subscription, timeout } from 'rxjs';
import { CommonModule } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';
import { UsuarioService } from '../../services/usuario.service';
import { CuentaService } from '../../services/cuenta.service';
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
import { Router } from '@angular/router';
import { MatTooltipModule } from '@angular/material/tooltip';

@Component({
  selector: 'app-usuarios',
  standalone: true,
  imports: [CommonModule, FormsModule, MatButtonModule, MatCardModule, MatDialogModule,
    MatFormFieldModule, MatIconModule, MatInputModule, MatProgressSpinnerModule,
    MatSelectModule, MatSnackBarModule, MatTableModule, MatTooltipModule],
  template: `
    <div class="page-container">
      <mat-card class="card toolbar">
        <div><h1>Gestión de Usuarios</h1><p>Administra clientes, roles y estado operativo.</p></div>
        <button mat-raised-button color="primary" (click)="abrirModal()">Nuevo usuario</button>
      </mat-card>

      <section class="filter-shell" aria-label="Filtros de usuarios">
        <form (ngSubmit)="aplicarFiltros()">
          <div class="filter-line"><label class="filter-search"><mat-icon>search</mat-icon><input aria-label="Buscar usuario" placeholder="Buscar por nombre, correo o DNI" [(ngModel)]="busqueda" name="busqueda"></label>
            <button class="filter-toggle" type="button" (click)="masFiltros=!masFiltros" [attr.aria-expanded]="masFiltros" aria-controls="advanced-usuarios"><mat-icon>tune</mat-icon>Más filtros<span class="filter-count" *ngIf="filtrosActivos">{{filtrosActivos}}</span></button>
            <button class="filter-apply" type="submit">Buscar</button>
            <button class="filter-clear" type="button" *ngIf="filtrosActivos" (click)="limpiarFiltros()">Limpiar</button>
          </div>
          <div class="filter-details" id="advanced-usuarios" *ngIf="masFiltros"><label>Rol<select [(ngModel)]="rol" name="rol"><option value="">Todos los roles</option><option value="CLIENTE">Cliente</option><option value="ADMIN">Administrador</option></select></label><label>Estado<select [(ngModel)]="estado" name="estado"><option [ngValue]="undefined">Todos los estados</option><option [ngValue]="true">Activo</option><option [ngValue]="false">Inactivo</option></select></label></div>
          <p class="filter-validation" role="alert" *ngIf="filtroError">{{filtroError}}</p>
        </form>
      </section>

      <mat-card class="card table-card">
        <table mat-table [dataSource]="usuarios">
          <ng-container matColumnDef="id"><th mat-header-cell *matHeaderCellDef>ID</th><td mat-cell *matCellDef="let u">#{{u.id}}</td></ng-container>
          <ng-container matColumnDef="usuario"><th mat-header-cell *matHeaderCellDef>Usuario</th><td mat-cell *matCellDef="let u">
            <strong>{{u.nombre}} {{u.apellido}}</strong><br><small>{{u.dni || 'DNI no registrado'}} · {{u.email}}</small>
          </td></ng-container>
          <ng-container matColumnDef="rol"><th mat-header-cell *matHeaderCellDef>Rol</th><td mat-cell *matCellDef="let u">{{u.rol}}</td></ng-container>
          <ng-container matColumnDef="estado"><th mat-header-cell *matHeaderCellDef>Estado</th><td mat-cell *matCellDef="let u">{{u.activo ? 'Activo' : 'Inactivo'}}</td></ng-container>
          <ng-container matColumnDef="acciones"><th mat-header-cell *matHeaderCellDef>Acciones</th><td mat-cell *matCellDef="let u">
            <button mat-button color="primary" (click)="verCuentas(u)">Ver cuentas</button>
            <button mat-icon-button (click)="editarUsuario(u)" matTooltip="Editar" [attr.aria-label]="'Editar a '+u.nombre" [disabled]="guardando || cambiandoEstado"><mat-icon>edit</mat-icon></button>
            <button mat-button (click)="cambiarEstado(u)" [disabled]="guardando || cambiandoEstado">{{u.activo ? 'Desactivar acceso' : 'Activar acceso'}}</button>
          </td></ng-container>
          <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr><tr mat-row *matRowDef="let row; columns: displayedColumns"></tr>
        </table>
        <div *ngIf="loading" class="center"><mat-spinner diameter="32"></mat-spinner></div>
        <div role="alert" class="form-feedback" *ngIf="errorCarga">{{errorCarga}} <button mat-button (click)="cargarUsuarios()">Reintentar</button></div>
        <div *ngIf="!loading && !errorCarga && usuarios.length === 0" class="center">No hay usuarios para los filtros seleccionados.</div>
        <div class="pager" *ngIf="!loading && !errorCarga">
          <button mat-button [disabled]="loading || page === 0" (click)="cambiarPagina(page - 1)">Anterior</button>
          <span>Página {{page + 1}} de {{totalPages || 1}} · {{totalElements}} usuarios</span>
          <button mat-button [disabled]="loading || page + 1 >= totalPages" (click)="cambiarPagina(page + 1)">Siguiente</button>
        </div>
      </mat-card>
    </div>

    <ng-template #usuarioDialog>
      <form #usuarioForm="ngForm" (ngSubmit)="guardar(usuarioForm)">
        <h2 mat-dialog-title>{{modoEdicion ? 'Editar perfil' : 'Nuevo usuario'}}</h2>
        <mat-dialog-content class="form">
          <p class="form-intro">{{modoEdicion ? 'Actualiza los datos del perfil. Deja la contraseña vacía para conservarla.' : 'Completa los datos de acceso y el perfil del usuario.'}}</p>
          <div role="alert" class="form-feedback" *ngIf="formError">{{formError}}</div>
          <div class="field-grid">
            <mat-form-field appearance="outline"><mat-label>Nombre</mat-label><input matInput [(ngModel)]="form.nombre" name="nombre" required maxlength="100" autocomplete="given-name"><mat-error>Ingresa el nombre.</mat-error></mat-form-field>
            <mat-form-field appearance="outline"><mat-label>Apellido</mat-label><input matInput [(ngModel)]="form.apellido" name="apellido" required maxlength="100" autocomplete="family-name"><mat-error>Ingresa el apellido.</mat-error></mat-form-field>
          </div>
          <mat-form-field appearance="outline"><mat-label>Correo electrónico</mat-label><input matInput [(ngModel)]="form.email" name="email" type="email" email maxlength="100" [disabled]="modoEdicion" required autocomplete="email"><mat-error>Ingresa un correo válido.</mat-error></mat-form-field>
          <mat-form-field appearance="outline"><mat-label>DNI (opcional)</mat-label><input matInput [(ngModel)]="form.dni" name="dni" maxlength="20"></mat-form-field>
          <mat-form-field appearance="outline"><mat-label>{{modoEdicion ? 'Nueva contraseña (opcional)' : 'Contraseña'}}</mat-label><input matInput [(ngModel)]="form.password" name="password" type="password" minlength="6" maxlength="72" [required]="!modoEdicion" autocomplete="new-password"><mat-hint>Entre 6 y 72 caracteres.</mat-hint><mat-error>Usa al menos 6 caracteres.</mat-error></mat-form-field>
          <mat-form-field appearance="outline"><mat-label>Permisos</mat-label><mat-select [(ngModel)]="form.rol" name="rol" required [disabled]="guardando"><mat-option value="CLIENTE">Cliente</mat-option><mat-option value="ADMIN">Administrador</mat-option></mat-select></mat-form-field>
          <p class="form-note" *ngIf="form.rol==='ADMIN'">El administrador puede gestionar usuarios, cuentas, movimientos y préstamos. Asigna este acceso solo a personal autorizado.</p>
        </mat-dialog-content>
        <mat-dialog-actions align="end"><button mat-button type="button" [disabled]="guardando" (click)="cerrarModal()">Cancelar</button><button mat-raised-button color="primary" type="submit" [disabled]="guardando">{{guardando ? 'Guardando…' : 'Guardar cambios'}}</button></mat-dialog-actions>
      </form>
    </ng-template>
    <ng-template #cuentasDialog>
      <h2 mat-dialog-title>Cuentas de {{usuarioSeleccionado?.nombre}} {{usuarioSeleccionado?.apellido}}</h2>
      <mat-dialog-content>
        <mat-spinner *ngIf="cargandoCuentas" diameter="30"></mat-spinner>
        <div role="alert" class="form-feedback" *ngIf="errorCuentas">{{errorCuentas}} <button mat-button (click)="cargarCuentasSeleccionadas()">Reintentar</button></div>
        <p *ngIf="!cargandoCuentas && !errorCuentas && cuentasUsuario.length === 0">Este usuario no tiene cuentas.</p>
        <table mat-table [dataSource]="cuentasUsuario" *ngIf="!cargandoCuentas && cuentasUsuario.length">
          <ng-container matColumnDef="numero"><th mat-header-cell *matHeaderCellDef>Número</th><td mat-cell *matCellDef="let c">{{c.numeroCuenta}}</td></ng-container>
          <ng-container matColumnDef="tipo"><th mat-header-cell *matHeaderCellDef>Tipo</th><td mat-cell *matCellDef="let c">{{c.tipoCuenta}}</td></ng-container>
          <ng-container matColumnDef="saldo"><th mat-header-cell *matHeaderCellDef>Saldo</th><td mat-cell *matCellDef="let c">{{c.moneda}} {{c.saldo | number:'1.2-2'}}</td></ng-container>
          <tr mat-header-row *matHeaderRowDef="cuentaColumns"></tr><tr mat-row *matRowDef="let row; columns: cuentaColumns"></tr>
        </table>
      </mat-dialog-content>
      <mat-dialog-actions align="end"><button mat-button (click)="abrirCuentaParaUsuario()">Añadir cuenta a este usuario</button><button mat-button (click)="cerrarModal()">Cerrar</button></mat-dialog-actions>
    </ng-template>
  `,
  styles: [`.toolbar,.filters{display:flex;gap:16px;align-items:center;justify-content:space-between;margin-bottom:16px}.filters{justify-content:flex-start;flex-wrap:wrap}.filters mat-form-field{min-width:210px}.table-card{overflow:auto}.center{text-align:center;padding:24px}.pager{display:flex;align-items:center;justify-content:center;gap:18px;padding:16px}.form{display:grid;gap:12px;min-width:min(90vw,500px)}`]
})
export class UsuariosComponent implements OnInit, OnDestroy {
  errorCarga=''; errorCuentas=''; cambiandoEstado=false;
  private consulta?: Subscription;
  private consultaCuentas?: Subscription;
  private confirmacionRef?:MatDialogRef<ConfirmationDialogComponent>;
  private operaciones=new Subscription();
  masFiltros=false; filtroError='';
  get filtrosActivos():number {return Number(!!this.busqueda.trim())+Number(!!this.rol)+Number(this.estado!==undefined);}
  aplicarFiltros():void {this.filtroError='';this.page=0;this.cargarUsuarios();}
  limpiarFiltros():void {this.busqueda='';this.rol='';this.estado=undefined;this.filtroError='';this.masFiltros=false;this.page=0;this.cargarUsuarios();}

  usuarios: Usuario[] = [];
  cuentasUsuario: Cuenta[] = [];
  usuarioSeleccionado: Usuario | null = null;
  guardando = false; formError = '';
  loading = true; cargandoCuentas = false; modoEdicion = false; editandoId: number | null = null;
  page = 0; size = 10; totalPages = 0; totalElements = 0; rol = ''; estado: boolean | undefined; busqueda = '';
  form: Usuario = this.formVacio();
  dialogRef: MatDialogRef<unknown> | null = null;
  @ViewChild('usuarioDialog') usuarioDialogTpl!: TemplateRef<unknown>;
  @ViewChild('cuentasDialog') cuentasDialogTpl!: TemplateRef<unknown>;

  constructor(private usuarioSvc: UsuarioService, private cuentaSvc: CuentaService, private dialog: MatDialog, private snack: MatSnackBar, private router: Router) {}
  get displayedColumns(): string[] { return ['id', 'usuario', 'rol', 'estado', 'acciones']; }
  get cuentaColumns(): string[] { return ['numero', 'tipo', 'saldo']; }
  ngOnInit(): void { this.cargarUsuarios(); }
  cargarUsuarios(): void {
    this.consulta?.unsubscribe(); this.loading = true; this.errorCarga=''; this.usuarios=[];
    this.consulta=this.usuarioSvc.getPage(this.page, this.size, this.rol, this.estado, this.busqueda).pipe(timeout(15000)).subscribe({
      next: p => {
        if(this.page>0 && this.page>=p.totalPages){this.page=Math.max(0,p.totalPages-1);this.cargarUsuarios();return;}
        this.usuarios = p.content; this.totalPages = p.totalPages; this.totalElements = p.totalElements; this.loading = false;
      },
      error: () => { this.loading = false; this.totalPages=0; this.totalElements=0; this.errorCarga='No pudimos cargar los usuarios. Intenta nuevamente.'; }
    });
  }
  cambiarPagina(page: number): void { if(this.loading || page<0 || page>=this.totalPages)return; this.page = page; this.cargarUsuarios(); }
  abrirModal(): void { if(this.guardando || this.cambiandoEstado)return;this.formError='';this.form = this.formVacio(); this.modoEdicion = false; this.abrirDialogo(this.usuarioDialogTpl); }
  editarUsuario(u: Usuario): void { if(this.guardando || this.cambiandoEstado)return;this.formError='';this.form = {...u, password: ''}; this.editandoId = u.id!; this.modoEdicion = true; this.abrirDialogo(this.usuarioDialogTpl); }
  guardar(formulario?: NgForm): void {
    if(this.guardando) return;
    this.formError=''; formulario?.form.markAllAsTouched();
    const payload={...this.form,nombre:this.form.nombre.trim(),apellido:this.form.apellido.trim(),email:this.form.email.trim().toLowerCase()};
    const password=payload.password || '';
    if(formulario?.invalid || !payload.nombre || !payload.apellido || !emailValido(payload.email)
        || (!this.modoEdicion && password.length<6) || (password.length>0 && password.length<6) || password.length>72) {
      this.formError='Revisa nombre, apellido, correo y contraseña antes de continuar.'; return;
    }
    if(this.modoEdicion && !password) delete payload.password;
    this.guardando=true;
    const request=this.modoEdicion ? this.usuarioSvc.update(this.editandoId!,payload) : this.usuarioSvc.create(payload);
    this.operaciones.add(request.subscribe({next:()=>{this.guardando=false;this.cerrarModal();this.cargarUsuarios();this.snack.open('Perfil guardado','Cerrar',{duration:2500})},error:e=>{this.guardando=false;this.formError=e.error?.message || 'No se pudo guardar el perfil. Tus cambios siguen aquí.'}}));
  }

  async cambiarEstado(u: Usuario): Promise<void> {
    if(this.cambiandoEstado || this.guardando)return;
    this.cambiandoEstado=true;
    const activo=!u.activo;
    this.confirmacionRef=this.dialog.open(ConfirmationDialogComponent,{width:'460px',maxWidth:'94vw',autoFocus:false,data:{
      titulo:activo?'Activar acceso':'Desactivar acceso',motivo:false,
      texto:`${u.nombre} ${u.apellido} · ${u.email}. ${activo?'Podrá iniciar sesión nuevamente.':'Se revocará su acceso. Sus cuentas, obligaciones e historial se conservarán.'}`
    }});
    const confirmado=await firstValueFrom(this.confirmacionRef.afterClosed());this.confirmacionRef=undefined;
    if(!confirmado || this.destruido){this.cambiandoEstado=false;return;}
    this.operaciones.add(this.usuarioSvc.cambiarEstado(u.id!,activo).subscribe({
      next:()=>{this.cambiandoEstado=false;this.cargarUsuarios();this.snack.open(activo?'Acceso activado':'Acceso desactivado','Cerrar',{duration:3000});},
      error:e=>{this.cambiandoEstado=false;this.snack.open(e.error?.message || 'No pudimos confirmar el cambio de acceso. Actualiza la lista para comprobar su estado.','Cerrar',{duration:5000});this.cargarUsuarios();}
    }));
  }
  verCuentas(u: Usuario): void { this.usuarioSeleccionado = u; this.abrirDialogo(this.cuentasDialogTpl); this.cargarCuentasSeleccionadas(); }
  cargarCuentasSeleccionadas(): void {
    if(!this.usuarioSeleccionado)return;
    this.consultaCuentas?.unsubscribe();this.cargandoCuentas=true;this.cuentasUsuario=[];this.errorCuentas='';
    this.consultaCuentas=this.cuentaSvc.getByUsuario(this.usuarioSeleccionado.id!).pipe(timeout(15000)).subscribe({
    next: cuentas => { this.cuentasUsuario = cuentas; this.cargandoCuentas = false; },
    error: () => { this.cargandoCuentas = false; this.errorCuentas='No pudimos cargar las cuentas de este usuario. Intenta nuevamente.'; }
  }); }
  abrirCuentaParaUsuario(): void {
    this.cerrarModal();
    this.router.navigate(['/cuentas'], { queryParams: { usuarioId: this.usuarioSeleccionado?.id } });
  }
  cerrarModal(): void { if(this.guardando)return; this.consultaCuentas?.unsubscribe(); this.dialogRef?.close(); this.dialogRef=null; }
  private destruido=false;
  ngOnDestroy():void { this.destruido=true;this.consulta?.unsubscribe();this.consultaCuentas?.unsubscribe();this.operaciones.unsubscribe();this.dialogRef?.close();this.confirmacionRef?.close(false); }
  private abrirDialogo(template: TemplateRef<unknown>): void { this.dialogRef?.close(); this.dialogRef = this.dialog.open(template, {width: 'min(92vw, 700px)', disableClose: true}); }
  private formVacio(): Usuario { return {email: '', password: '', nombre: '', apellido: '', rol: 'CLIENTE'}; }
}
