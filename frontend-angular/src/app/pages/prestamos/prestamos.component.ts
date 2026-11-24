import { solicitarConfirmacion } from '../../components/confirmation-dialog.component';
import { UsuarioService } from '../../services/usuario.service';
import { importeValido } from '../../models/form-rules';
import { SolicitudPendienteService } from '../../services/solicitud-pendiente.service';
import { Subscription, timeout } from 'rxjs';
import { RouterLink } from '@angular/router';
import { Component, OnInit, OnDestroy, TemplateRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PrestamoService } from '../../services/prestamo.service';
import { CuentaService } from '../../services/cuenta.service';
import { AuthService } from '../../services/auth.service';
import { Prestamo, Cuenta, Usuario } from '../../models/models';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';

@Component({
  selector: 'app-prestamos',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    FormsModule,
    MatButtonModule,
    MatCardModule,
    MatChipsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressSpinnerModule,
    MatSelectModule,
    MatSnackBarModule,
    MatTableModule,
    MatTooltipModule
  ],
  template: `
    <div class="page-container prestamos-page">
      <mat-card class="hero-card">
        <div class="hero-copy">
          <div class="eyebrow">Banca digital</div>
          <h1>{{ isAdmin ? 'Gestión de Préstamos' : 'Mis Préstamos' }}</h1>
          <p>
            Consulta tus solicitudes, cronogramas y pagos en un solo lugar.
          </p>
        </div>
        <div class="hero-actions">
          <button mat-raised-button color="primary" (click)="abrirModal()">
            <mat-icon>add</mat-icon>
            {{ tieneSolicitudPendiente ? 'Retomar solicitud' : isAdmin ? 'Nuevo préstamo' : 'Solicitar préstamo' }}
          </button>
        </div>
      </mat-card>

      <div class="kpi-grid">
        <mat-card class="kpi-card soft-blue">
          <div class="kpi-label">Préstamos</div>
          <div class="kpi-value">{{ totalPrestamos }}</div>
          <div class="kpi-hint">Registrados en el sistema</div>
        </mat-card>
        <mat-card class="kpi-card soft-amber">
          <div class="kpi-label">Pendientes</div>
          <div class="kpi-value">{{ totalPendientes }}</div>
          <div class="kpi-hint">En revisión o espera</div>
        </mat-card>
        <mat-card class="kpi-card soft-emerald">
          <div class="kpi-label">Monto solicitado</div>
          <div class="kpi-value">PEN {{ montoPen | number:'1.2-2' }}</div>
          <div class="kpi-hint">USD {{ montoUsd | number:'1.2-2' }} · Registros de esta página</div>
        </mat-card>
      </div>

      <mat-card class="notice-card admin-notice" *ngIf="isAdmin">
        <mat-icon>link</mat-icon>
        <div>
          <strong>Solicitud verificada</strong>
          <p>
            Elige al cliente y una de sus cuentas activas. La moneda se completa automáticamente.
          </p>
        </div>
      </mat-card>

      <mat-card class="notice-card client-notice" *ngIf="!isAdmin">
        <mat-icon>info</mat-icon>
        <div>
          <strong>Solicitud guiada</strong>
          <p>
            Abre el detalle de una solicitud para ver sus cuotas, registrar pagos o cancelarla antes de la aprobación.
          </p>
        </div>
      </mat-card>

      <mat-card class="table-card">
        <div class="table-header">
          <div>
            <h2>Listado de préstamos</h2>
            <p>Consulta el cronograma y el historial de cada préstamo.</p>
          </div>
          <button mat-stroked-button color="primary" (click)="cargarPrestamos()">
            <mat-icon>refresh</mat-icon>
            Actualizar
          </button>
        </div>

        <div class="table-wrapper">
          <table mat-table [dataSource]="prestamos" class="prestamo-table" aria-label="Tabla de préstamos">
            <ng-container matColumnDef="numeroPrestamo">
              <th mat-header-cell *matHeaderCellDef>N° préstamo</th>
              <td mat-cell *matCellDef="let p">
                <span class="mono-pill">{{ p.numeroPrestamo || ('#' + p.id) }}</span>
              </td>
            </ng-container>

            <ng-container matColumnDef="usuario" *ngIf="isAdmin">
              <th mat-header-cell *matHeaderCellDef>Usuario</th>
              <td mat-cell *matCellDef="let p">
                <div class="user-cell">
                  <strong>{{ p.nombreUsuario || 'Usuario #' + p.usuarioId }}</strong>
                  <span>ID {{ p.usuarioId }}</span>
                </div>
              </td>
            </ng-container>

            <ng-container matColumnDef="cuenta">
              <th mat-header-cell *matHeaderCellDef>Cuenta</th>
              <td mat-cell *matCellDef="let p">
                <div class="account-cell">
                  <strong>{{ p.numeroCuenta || ('Cuenta #' + p.cuentaDesembolsoId) }}</strong>
                  <span>{{ p.moneda || 'PEN' }}</span>
                </div>
              </td>
            </ng-container>

            <ng-container matColumnDef="tipo">
              <th mat-header-cell *matHeaderCellDef>Tipo</th>
              <td mat-cell *matCellDef="let p">
                <span class="type-chip">{{ p.tipoPrestamo }}</span>
              </td>
            </ng-container>

            <ng-container matColumnDef="monto">
              <th mat-header-cell *matHeaderCellDef>Monto</th>
              <td mat-cell *matCellDef="let p">
                <strong>{{ p.moneda }} {{ p.montoSolicitado | number:'1.2-2' }}</strong>
              </td>
            </ng-container>

            <ng-container matColumnDef="tasa">
              <th mat-header-cell *matHeaderCellDef>Tasa</th>
              <td mat-cell *matCellDef="let p">{{ p.tasaInteres }}%</td>
            </ng-container>

            <ng-container matColumnDef="plazo">
              <th mat-header-cell *matHeaderCellDef>Plazo</th>
              <td mat-cell *matCellDef="let p">{{ p.plazoMeses }} meses</td>
            </ng-container>

            <ng-container matColumnDef="cuota">
              <th mat-header-cell *matHeaderCellDef>Cuota</th>
              <td mat-cell *matCellDef="let p">
                <strong>{{ p.moneda }} {{ p.cuotaMensual | number:'1.2-2' }}</strong>
              </td>
            </ng-container>

            <ng-container matColumnDef="estado">
              <th mat-header-cell *matHeaderCellDef>Estado</th>
              <td mat-cell *matCellDef="let p">
                <span class="status-chip" [ngClass]="estadoClase(p.estado)">
                  {{ p.estado || 'PENDIENTE' }}
                </span>
              </td>
            </ng-container>

            <ng-container matColumnDef="acciones">
              <th mat-header-cell *matHeaderCellDef>Acciones</th>
              <td mat-cell *matCellDef="let p">
                <a mat-button color="primary" [routerLink]="['/prestamos',p.id]" [attr.aria-label]="(isAdmin && ['PENDIENTE','EN_REVISION'].includes(p.estado || '') ? 'Evaluar solicitud ' : 'Ver detalle de ')+p.numeroPrestamo">{{isAdmin && ['PENDIENTE','EN_REVISION'].includes(p.estado || '') ? 'Evaluar solicitud' : 'Ver detalle'}}</a>
                <div class="actions-cell" *ngIf="isAdmin; else clienteActions">
                  <button *ngIf="p.estado === 'APROBADO'" mat-icon-button color="primary" matTooltip="Desembolsar préstamo" (click)="desembolsarPrestamo(p.id!)">
                    <mat-icon>payments</mat-icon>
                  </button>
                </div>
                <ng-template #clienteActions>
                  <div class="actions-cell">
                    <span *ngIf="p.estado === 'VENCIDO'" class="muted-action">Cuotas por regularizar</span>
                  </div>
                </ng-template>
              </td>
            </ng-container>

            <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
            <tr mat-row *matRowDef="let row; columns: displayedColumns"></tr>
          </table>
          <div *ngIf="isAdmin && !loading && !errorLista" class="actions-cell">
            <button mat-button [disabled]="pagina===0" (click)="cambiarPagina(-1)">Anterior</button>
            <span>Página {{pagina+1}} de {{totalPaginas || 1}}</span>
            <button mat-button [disabled]="pagina+1>=totalPaginas" (click)="cambiarPagina(1)">Siguiente</button>
          </div>

          <div class="loading-overlay" *ngIf="loading">
            <mat-progress-spinner diameter="42" mode="indeterminate"></mat-progress-spinner>
            <span>Cargando préstamos...</span>
          </div>

          <div role="alert" class="form-feedback" *ngIf="errorLista">{{errorLista}} <button mat-button (click)="cargarPrestamos()">Reintentar</button></div>
          <div class="empty-state" *ngIf="!loading && !errorLista && prestamos.length === 0">
            <mat-icon>account_balance_wallet</mat-icon>
            <h3>{{ isAdmin ? 'No hay préstamos registrados' : 'No tienes préstamos solicitados' }}</h3>
            <p>{{isAdmin ? 'Las solicitudes de los clientes aparecerán aquí para su evaluación.' : 'Puedes iniciar una solicitud cuando tengas una cuenta activa.'}}</p>
          </div>
        </div>
      </mat-card>
    </div>

    <ng-template #loanDialog>
      <h2 mat-dialog-title>{{ revisandoSolicitud ? 'Revisa tu solicitud' : isAdmin ? 'Nuevo préstamo' : 'Solicitar préstamo' }}</h2>
      <mat-dialog-content class="dialog-content">
        <form #prestamoForm="ngForm" class="dialog-form">
          <div *ngIf="formError" class="form-feedback" role="alert">{{formError}}</div>
        

        <div class="dialog-grid" *ngIf="!revisandoSolicitud">
          <mat-form-field appearance="outline" floatLabel="always" subscriptSizing="dynamic" *ngIf="isAdmin"><mat-label>Cliente</mat-label>
            <mat-select [(ngModel)]="form.usuarioId" name="usuarioId" required (selectionChange)="cambiarCliente()"><mat-option *ngFor="let c of clientes" [value]="c.id">{{c.nombre}} {{c.apellido}} · {{c.email}}</mat-option></mat-select>
          </mat-form-field>
          <mat-form-field appearance="outline" floatLabel="always" subscriptSizing="dynamic"><mat-label>Cuenta de desembolso</mat-label>
            <mat-select [(ngModel)]="form.cuentaDesembolsoId" name="cuentaDesembolsoId" required [disabled]="cargandoCuentas || !misCuentas.length" (selectionChange)="cambiarCuenta()"><mat-option *ngFor="let c of misCuentas" [value]="c.id">{{c.numeroCuenta}} · {{c.moneda}}</mat-option></mat-select>
            <mat-hint>{{cargandoCuentas ? 'Cargando cuentas…' : 'Solo cuentas activas del titular.'}}</mat-hint>
          </mat-form-field>
          <p class="form-note" *ngIf="!cargandoCuentas && !misCuentas.length">{{isAdmin ? 'Selecciona un cliente con una cuenta activa para continuar.' : 'Necesitas una cuenta activa para recibir el desembolso.'}}</p>
          <button mat-button type="button" [disabled]="cargandoCuentas || !form.usuarioId" (click)="actualizarCuentasSolicitud()">Actualizar cuentas</button>
          <mat-form-field appearance="outline" floatLabel="always" subscriptSizing="dynamic">
            <mat-label>Tipo de préstamo</mat-label>
            <mat-select [(ngModel)]="form.tipoPrestamo" name="tipoPrestamo" required #tipoPrestamoModel="ngModel">
              <mat-option value="PERSONAL">PERSONAL</mat-option>
              <mat-option value="HIPOTECARIO">HIPOTECARIO</mat-option>
              <mat-option value="VEHICULAR">VEHICULAR</mat-option>
              <mat-option value="EMPRESARIAL" *ngIf="isAdmin">EMPRESARIAL</mat-option>
              <mat-option value="CONSUMO">CONSUMO</mat-option>
            </mat-select>
            <mat-error *ngIf="tipoPrestamoModel.invalid && (tipoPrestamoModel.dirty || tipoPrestamoModel.touched)">Seleccione un tipo de préstamo.</mat-error>
          </mat-form-field>

          <mat-form-field appearance="outline" floatLabel="always" subscriptSizing="dynamic">
            <mat-label>Moneda</mat-label>
            <mat-select [(ngModel)]="form.moneda" name="moneda" required #monedaModel="ngModel" [disabled]="true">
              <mat-option value="PEN">PEN - Soles</mat-option>
              <mat-option value="USD">USD - Dólares</mat-option>
            </mat-select>
            <mat-error *ngIf="monedaModel.invalid && (monedaModel.dirty || monedaModel.touched)">Seleccione una moneda.</mat-error>
          </mat-form-field>

          <mat-form-field appearance="outline" floatLabel="always" subscriptSizing="dynamic">
            <mat-label>Monto solicitado</mat-label>
            <input matInput type="number" inputmode="decimal" [(ngModel)]="form.montoSolicitado" name="montoSolicitado" placeholder="5000.00" step="0.01" required min="500" max="9999999999999.99" [pattern]="patronDecimal" #montoSolicitadoModel="ngModel" />
            <mat-hint>Mínimo 500 en la moneda de la cuenta.</mat-hint>
            <mat-error *ngIf="montoSolicitadoModel.invalid">Ingresa entre 500 y 9,999,999,999,999.99, con hasta 2 decimales.</mat-error>
          </mat-form-field>

          <mat-form-field appearance="outline" floatLabel="always" subscriptSizing="dynamic">
            <mat-label>Tasa de interés anual (%)</mat-label>
            <input matInput type="number" inputmode="decimal" [(ngModel)]="form.tasaInteres" name="tasaInteres" placeholder="18.00" step="0.01" required min="1" max="100" [pattern]="patronDecimal" [readonly]="!isAdmin" #tasaInteresModel="ngModel" />
            <mat-hint *ngIf="!isAdmin">Tasa vigente: 18 % anual.</mat-hint>
            <mat-error *ngIf="tasaInteresModel.invalid">Usa una tasa de 1 a 100 %, con hasta 2 decimales.</mat-error>
          </mat-form-field>

          <mat-form-field appearance="outline" floatLabel="always" subscriptSizing="dynamic" class="full-width">
            <mat-label>Plazo en meses</mat-label>
            <input matInput type="number" inputmode="numeric" [(ngModel)]="form.plazoMeses" name="plazoMeses" placeholder="12" min="3" max="360" step="1" pattern="[0-9]+" required #plazoMesesModel="ngModel" />
            <mat-error *ngIf="plazoMesesModel.invalid">Ingresa un número entero de 3 a 360 meses.</mat-error>
          </mat-form-field>
        </div>

        <div class="review-summary" *ngIf="revisandoSolicitud">
          <strong class="review-amount">{{form.moneda}} {{form.montoSolicitado | number:'1.2-2'}}</strong>
          <dl><dt>Cuenta de desembolso</dt><dd>{{form.numeroCuenta}}</dd><dt>Tipo</dt><dd>{{form.tipoPrestamo}}</dd><dt>Tasa anual</dt><dd>{{form.tasaInteres}} %</dd><dt>Plazo</dt><dd>{{form.plazoMeses}} meses</dd><dt>Cuota mensual estimada</dt><dd>{{form.moneda}} {{calcularCuota() | number:'1.2-2'}}</dd><dt>Intereses estimados</dt><dd>{{form.moneda}} {{interesesEstimados | number:'1.2-2'}}</dd><dt>Total estimado a pagar</dt><dd>{{form.moneda}} {{totalEstimado | number:'1.2-2'}}</dd></dl>
          <p class="form-note">La solicitud queda pendiente de evaluación. Los importes definitivos se muestran al registrarla.</p>
          <p class="form-feedback" *ngIf="resultadoSolicitudIncierto" role="status">Conservamos esta solicitud y su clave. Retómala para confirmar su resultado.</p>
        </div>
        <p class="form-feedback" role="alert" *ngIf="!revisandoSolicitud && totalExcedeMaximo">El total supera el máximo permitido. Reduce el importe o el plazo.</p>
        <mat-card class="preview-card" *ngIf="!revisandoSolicitud && importesValidos && !totalExcedeMaximo">
          <div>
            <span class="preview-label">Cuota mensual estimada</span>
            <strong>{{ form.moneda }} {{ calcularCuota() | number:'1.2-2' }}</strong>
          </div>
          <span class="preview-note">Intereses estimados: {{form.moneda}} {{interesesEstimados | number:'1.2-2'}}<br>Total estimado: {{form.moneda}} {{totalEstimado | number:'1.2-2'}}</span>
        </mat-card>
        </form>
      </mat-dialog-content>

      <mat-dialog-actions align="end" class="dialog-actions">
        <button mat-button [disabled]="guardando" (click)="resultadoSolicitudIncierto || !revisandoSolicitud ? cerrarModal() : volverSolicitud()">{{resultadoSolicitudIncierto ? 'Continuar después' : revisandoSolicitud ? 'Volver' : 'Cancelar'}}</button>
        <button mat-raised-button color="primary" (click)="revisandoSolicitud ? guardar() : revisarSolicitud()" [disabled]="guardando || (!revisandoSolicitud && (prestamoForm.invalid || !solicitudValida || cargandoCuentas))">
          {{ guardando ? 'Confirmando…' : resultadoSolicitudIncierto ? 'Consultar resultado' : revisandoSolicitud ? 'Confirmar solicitud' : 'Revisar solicitud' }}
        </button>
      </mat-dialog-actions>
    </ng-template>

    <ng-template #paymentDialog>
      <h2 mat-dialog-title>Pagar cuota</h2>
      <mat-dialog-content class="dialog-content">
        <p class="form-note">El pago no puede superar el saldo de tu cuenta ni la deuda pendiente.</p>
        <p>Saldo pendiente: <strong>{{ pagoPrestamo?.moneda }} {{ pagoPrestamo?.saldoPendiente | number:'1.2-2' }}</strong></p>
        <mat-form-field appearance="outline">
          <mat-label>Cuenta para debitar</mat-label>
          <mat-select [(ngModel)]="pagoCuentaId" name="pagoCuentaId" required>
            <mat-option *ngFor="let c of cuentasParaPago" [value]="c.id">
              {{ c.numeroCuenta }} · {{ c.moneda }} {{ c.saldo | number:'1.2-2' }}
            </mat-option>
          </mat-select>
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Monto del pago</mat-label>
          <input matInput type="number" [(ngModel)]="pagoMonto" name="pagoMonto" min="0.01" step="0.01" required>
        </mat-form-field>
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        <button mat-button (click)="cerrarModal()">Cancelar</button>
        <button mat-raised-button color="primary" (click)="confirmarPago()" [disabled]="pagoEnCurso || !pagoValido">Pagar</button>
      </mat-dialog-actions>
    </ng-template>
  `,
  styles: [`
    .prestamos-page { display: grid; gap: 18px; }

    .hero-card,
    .table-card,
    .notice-card,
    .preview-card,
    .kpi-card {
      border-radius: 20px;
      box-shadow: 0 14px 40px rgba(15, 23, 42, 0.08);
      border: 1px solid rgba(37, 99, 235, 0.08);
    }

    .hero-card {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 20px;
      background: linear-gradient(135deg, #ffffff 0%, #f7faff 100%);
    }

    .hero-copy h1 {
      margin: 0;
      font-size: 28px;
      font-weight: 800;
      color: #0f172a;
    }

    .hero-copy .eyebrow {
      display: inline-flex;
      align-items: center;
      padding: 6px 12px;
      margin-bottom: 12px;
      border-radius: 999px;
      background: #e8f1ff;
      color: #1d4ed8;
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 0.3px;
      text-transform: uppercase;
    }

    .hero-copy p,
    .table-header p,
    .notice-card p,
    .kpi-hint {
      color: #64748b;
      margin: 0;
      line-height: 1.5;
    }

    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 16px;
    }

    .kpi-card { padding: 18px 20px; background: #ffffff; }
    .kpi-card.soft-blue { background: linear-gradient(180deg, #eff6ff 0%, #ffffff 100%); }
    .kpi-card.soft-amber { background: linear-gradient(180deg, #fff7ed 0%, #ffffff 100%); }
    .kpi-card.soft-emerald { background: linear-gradient(180deg, #ecfdf5 0%, #ffffff 100%); }

    .kpi-label {
      color: #64748b;
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.4px;
      margin-bottom: 10px;
    }

    .kpi-value {
      font-size: 28px;
      font-weight: 800;
      color: #0f172a;
      line-height: 1.1;
      margin-bottom: 6px;
    }

    .notice-card {
      display: flex;
      align-items: flex-start;
      gap: 14px;
      padding: 16px 18px;
    }

    .notice-card mat-icon {
      color: #2563eb;
      background: #eff6ff;
      border-radius: 12px;
      padding: 10px;
    }

    .admin-notice { background: linear-gradient(180deg, #eff6ff 0%, #ffffff 100%); }
    .client-notice { background: linear-gradient(180deg, #f8fafc 0%, #ffffff 100%); }

    .notice-card strong,
    .table-header h2,
    .empty-state h3,
    .preview-card strong { color: #0f172a; }

    .table-card { padding: 20px; }

    .table-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 16px;
      margin-bottom: 18px;
    }

    .table-header h2 {
      margin: 0 0 4px 0;
      font-size: 18px;
      font-weight: 700;
    }

    .table-wrapper {
      position: relative;
      overflow: auto;
      border-radius: 16px;
      border: 1px solid #e2e8f0;
      background: #ffffff;
    }

    table.prestamo-table {
      width: 100%;
      min-width: 980px;
      background: #ffffff;
    }

    .prestamo-table th {
      font-size: 12px;
      color: #64748b;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.4px;
      background: #f8fafc;
    }

    .prestamo-table td,
    .prestamo-table th { padding-inline: 16px; }

    .mono-pill,
    .type-chip,
    .status-chip {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border-radius: 999px;
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 0.2px;
      padding: 6px 12px;
      white-space: nowrap;
    }

    .mono-pill { background: #eff6ff; color: #1d4ed8; }
    .type-chip { background: #f1f5f9; color: #334155; }
    .status-chip.status-pendiente { background: #dbeafe; color: #1d4ed8; }
    .status-chip.status-revision { background: #fef3c7; color: #92400e; }
    .status-chip.status-aprobado,
    .status-chip.status-desembolsado { background: #dcfce7; color: #166534; }
    .status-chip.status-pagado { background: #dbeafe; color: #1d4ed8; }
    .status-chip.status-rechazado,
    .status-chip.status-vencido { background: #fee2e2; color: #b91c1c; }
    .status-chip.status-default { background: #e2e8f0; color: #475569; }

    .user-cell,
    .account-cell {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .user-cell span,
    .account-cell span,
    .muted-action {
      color: #94a3b8;
      font-size: 12px;
    }

    .actions-cell {
      display: flex;
      align-items: center;
    }

    .loading-overlay,
    .empty-state {
      display: flex;
      align-items: center;
      justify-content: center;
      flex-direction: column;
      gap: 10px;
      padding: 28px;
      text-align: center;
    }

    .loading-overlay {
      position: absolute;
      inset: 0;
      background: rgba(255, 255, 255, 0.8);
      backdrop-filter: blur(2px);
      z-index: 1;
    }

    .empty-state mat-icon {
      font-size: 44px;
      color: #94a3b8;
    }

    .dialog-content {
      display: grid;
      gap: 18px;
      min-width: 0;
    }

    .dialog-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 14px;
    }

    .full-width { grid-column: 1 / -1; }

    .preview-card {
      padding: 16px 18px;
      background: linear-gradient(180deg, #ecfdf5 0%, #ffffff 100%);
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
    }

    .preview-label {
      display: block;
      font-size: 12px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.4px;
      color: #64748b;
      margin-bottom: 4px;
    }

    @media (max-width: 960px) {
      .hero-card {
        align-items: flex-start;
        flex-direction: column;
      }

      .kpi-grid,
      .dialog-grid { grid-template-columns: 1fr; }

      .table-header {
        align-items: flex-start;
        flex-direction: column;
      }

      .preview-card {
        align-items: flex-start;
        flex-direction: column;
      }
    }
  `]
})
export class PrestamosComponent implements OnInit, OnDestroy {
  errorLista=''; private consultaLista?:Subscription;
  readonly patronDecimal = /^\d+(\.\d{1,2})?$/;
  revisandoSolicitud = false;
  resultadoSolicitudIncierto = false;
  tieneSolicitudPendiente = false;
  solicitudId: string = crypto.randomUUID();
  private cargaSolicitud?: Subscription;
  get importesValidos(): boolean {
    return importeValido(this.form.montoSolicitado, 500) && this.patronDecimal.test(String(this.form.montoSolicitado))
      && importeValido(this.form.tasaInteres, 1) && this.form.tasaInteres <= 100 && this.patronDecimal.test(String(this.form.tasaInteres))
      && Number.isInteger(this.form.plazoMeses) && this.form.plazoMeses >= 3 && this.form.plazoMeses <= 360;
  }
  get solicitudValida(): boolean {
    return this.importesValidos && !this.totalExcedeMaximo && this.misCuentas.some(c => c.id === this.form.cuentaDesembolsoId && c.usuarioId === this.form.usuarioId && c.estado === 'ACTIVA');
  }
  get totalExcedeMaximo(): boolean { return this.importesValidos && this.totalEstimado > 9999999999999.99; }
  get totalEstimado(): number { return Math.round(this.calcularCuota() * this.form.plazoMeses * 100) / 100; }
  get interesesEstimados(): number { return Math.round((this.totalEstimado - this.form.montoSolicitado) * 100) / 100; }
  prestamos: Prestamo[] = [];
  misCuentas: Cuenta[] = [];
  loading = true;
  pagina = 0;
  totalPaginas = 0;
  guardando = false;
  mensaje = '';
  esError = false;
  pagoOperacionId = crypto.randomUUID();
  pagoEnCurso = false;
  pagoMonto = 0;
  pagoCuentaId = 0;
  pagoPrestamo: Prestamo | null = null;
  dialogRef: MatDialogRef<unknown> | null = null;

  @ViewChild('loanDialog') loanDialogTpl!: TemplateRef<unknown>;
  @ViewChild('paymentDialog') paymentDialogTpl!: TemplateRef<unknown>;

  clientes: Usuario[]=[]; formError=''; cargandoCuentas=false;
  form: Prestamo = this.formVacio();

  get isAdmin(): boolean { return this.auth.getSession()?.rol === 'ADMIN'; }
  get usuarioId(): number { return this.auth.getSession()!.usuarioId; }
  get displayedColumns(): string[] {
    return this.isAdmin
      ? ['numeroPrestamo', 'usuario', 'cuenta', 'tipo', 'monto', 'tasa', 'plazo', 'cuota', 'estado', 'acciones']
      : ['numeroPrestamo', 'cuenta', 'tipo', 'monto', 'tasa', 'plazo', 'cuota', 'estado', 'acciones'];
  }
  get totalPrestamos(): number { return this.prestamos.length; }
  get totalPendientes(): number { return this.prestamos.filter(p => p.estado === 'PENDIENTE' || p.estado === 'EN_REVISION').length; }
  get montoPen(): number {return this.prestamos.filter(p=>p.moneda==='PEN').reduce((s,p)=>s+p.montoSolicitado,0);}
  get montoUsd(): number {return this.prestamos.filter(p=>p.moneda==='USD').reduce((s,p)=>s+p.montoSolicitado,0);}
  get montoSolicitadoTotal(): number { return this.prestamos.reduce((s, p) => s + (p.montoSolicitado || 0), 0); }
  get monedaPrincipal(): string { return this.prestamos.find(p => p.moneda)?.moneda || 'PEN'; }

  constructor(
    private usuarioSvc: UsuarioService,
    private prestamoSvc: PrestamoService,
    private cuentaSvc: CuentaService,
    private auth: AuthService,
    private dialog: MatDialog,
    private snackBar: MatSnackBar,
    private solicitudes: SolicitudPendienteService
  ) {}

  ngOnInit(): void {
    this.tieneSolicitudPendiente = !!this.solicitudes.leer();
    this.cargarPrestamos();
    if (!this.isAdmin) this.cargarMisCuentas();
  }

  cargarMisCuentas(): void {
    this.cuentaSvc.getByUsuario(this.usuarioId).subscribe({
      next: (c) => this.misCuentas = c.filter(x => x.estado === 'ACTIVA'),
      error: () => {}
    });
  }

  cambiarPagina(delta: number): void { this.pagina += delta; this.cargarPrestamos(); }

  cargarPrestamos(): void {
    this.consultaLista?.unsubscribe(); this.loading = true; this.errorLista=''; this.prestamos=[];
    if (this.isAdmin) {
      this.consultaLista=this.prestamoSvc.getPage(this.pagina, 20).pipe(timeout(15000)).subscribe({
        next: page => {
          if(this.pagina>0 && this.pagina>=page.totalPages){this.pagina=Math.max(0,page.totalPages-1);this.cargarPrestamos();return;}
          this.prestamos = page.content; this.totalPaginas = page.totalPages; this.loading = false;
        },
        error: () => this.errorCargaPrestamos()
      });
    } else {
      this.consultaLista=this.prestamoSvc.getByUsuario(this.usuarioId).pipe(timeout(15000)).subscribe({
        next: data => { this.prestamos = data; this.loading = false; },
        error: () => this.errorCargaPrestamos()
      });
    }
  }

  private errorCargaPrestamos(): void {
    this.errorLista='No pudimos cargar los préstamos. Intenta nuevamente.';this.totalPaginas=0;
    this.loading = false;
  }

  abrirModal(): void {
    if (this.dialogRef) return;
    const pendiente = this.solicitudes.leer();
    this.tieneSolicitudPendiente = !!pendiente;
    this.resultadoSolicitudIncierto = !!pendiente;
    this.revisandoSolicitud = !!pendiente;
    this.solicitudId = pendiente?.clave || crypto.randomUUID();
    if (pendiente) {
      this.form = pendiente.prestamo;
      this.formError = '';
      this.abrirDialogo();
      return;
    }
    this.form = this.formVacio(); this.formError='';
    if(this.isAdmin) {
      this.misCuentas=[];
      this.usuarioSvc.getPage(0,200,'CLIENTE',true).subscribe({next:p=>this.clientes=p.content,error:()=>this.formError='No pudimos cargar los clientes.'});
    } else { this.form.usuarioId=this.usuarioId; this.actualizarCuentasSolicitud(); }
    this.abrirDialogo();
  }

  cerrarModal(): void { if (this.guardando || this.pagoEnCurso) return; this.cargaSolicitud?.unsubscribe(); this.cargandoCuentas=false; this.dialogRef?.close(); }

  cambiarCliente(): void {
    this.form.cuentaDesembolsoId=0; this.form.moneda=undefined;
    this.actualizarCuentasSolicitud();
  }
  actualizarCuentasSolicitud(): void {
    if (this.guardando || this.resultadoSolicitudIncierto) return;
    this.cargaSolicitud?.unsubscribe();
    this.revisandoSolicitud=false; this.misCuentas=[]; this.formError=''; this.cargandoCuentas=true;
    const id=this.form.usuarioId;
    this.cargaSolicitud=this.cuentaSvc.getByUsuario(id).pipe(timeout(10000)).subscribe({
      next: cuentas => {
        this.cargandoCuentas=false;
        this.misCuentas=cuentas.filter(c=>c.estado==='ACTIVA' && c.usuarioId===id);
        if (!this.misCuentas.some(c=>c.id===this.form.cuentaDesembolsoId)) this.form.cuentaDesembolsoId=0;
        this.cambiarCuenta();
      },
      error: () => {this.cargandoCuentas=false;this.formError='No pudimos cargar las cuentas. Usa Actualizar cuentas para reintentar.';}
    });
  }
  cambiarCuenta(): void { this.form.moneda=this.misCuentas.find(c=>c.id===this.form.cuentaDesembolsoId)?.moneda;this.formError=''; }

  revisarSolicitud(): void {
    if (this.guardando || this.cargandoCuentas || this.resultadoSolicitudIncierto) return;
    if (!this.solicitudValida) {this.formError='Revisa la cuenta activa, el importe, la tasa y el plazo.';return;}
    const cuenta=this.misCuentas.find(c=>c.id===this.form.cuentaDesembolsoId)!;
    this.form.moneda=cuenta.moneda;this.form.numeroCuenta=cuenta.numeroCuenta;
    this.formError='';this.revisandoSolicitud=true;
  }
  volverSolicitud(): void {
    if (this.guardando || this.resultadoSolicitudIncierto) return;
    this.revisandoSolicitud=false;this.formError='';
  }

  guardar(): void {
    if (this.guardando || !this.revisandoSolicitud) return;
    this.formError='';
    if (!this.resultadoSolicitudIncierto && !this.solicitudValida) return;
    if (!this.isAdmin) this.form.usuarioId = this.usuarioId;
    const reintentando=this.resultadoSolicitudIncierto;
    try {this.solicitudes.guardar(this.solicitudId,this.form);}
    catch {this.formError='No pudimos conservar la solicitud en este navegador. Intenta nuevamente.';return;}
    this.tieneSolicitudPendiente=true;this.resultadoSolicitudIncierto=true;
    this.guardando = true;
    const obs = this.prestamoSvc.create({...this.form},this.solicitudId);

    obs.subscribe({
      next: (prestamo) => {
        this.guardando=false;
        this.solicitudes.limpiar();this.tieneSolicitudPendiente=false;this.resultadoSolicitudIncierto=false;
        this.mostrarMensaje(reintentando ? `Resultado confirmado. Estado: ${prestamo.estado}.` : this.isAdmin ? 'Préstamo creado correctamente.' : 'Solicitud enviada. Un administrador la revisará pronto.');
        this.cerrarModal();
        this.cargarPrestamos();
        this.guardando = false;
      },
      error: (err) => {
        if (!reintentando && [400,403,404,422].includes(err.status)) {
          this.solicitudes.limpiar();this.tieneSolicitudPendiente=false;this.resultadoSolicitudIncierto=false;
          this.revisandoSolicitud=false;this.solicitudId=crypto.randomUUID();
        }
        this.formError=err.error?.message || 'No pudimos confirmar el resultado. Retoma esta misma solicitud para comprobarlo.';
        this.guardando = false;
      }
    });
  }

  async desembolsarPrestamo(id: number): Promise<void> {
    if (!await solicitarConfirmacion(this.dialog,'Desembolsar pr?stamo','Revisa la solicitud antes de confirmar esta decisi?n.')) return;
    this.prestamoSvc.desembolsar(id).subscribe({
      next: () => { this.mostrarMensaje('Préstamo desembolsado correctamente.'); this.cargarPrestamos(); },
      error: (err) => this.mostrarMensaje(err.error?.message || 'Error al desembolsar.', true)
    });
  }

  abrirPago(prestamo: Prestamo): void {
    this.pagoOperacionId = crypto.randomUUID();
    this.pagoPrestamo = prestamo;
    this.pagoMonto = Math.min(prestamo.cuotaMensual || 0, prestamo.saldoPendiente || prestamo.montoSolicitado);
    this.pagoCuentaId = this.cuentasParaPago[0]?.id || 0;
    this.abrirDialogoTemplate(this.paymentDialogTpl);
  }

  get cuentasParaPago(): Cuenta[] {return this.misCuentas.filter(c=>c.moneda===this.pagoPrestamo?.moneda);}
  get pagoValido(): boolean {
    const cuenta=this.misCuentas.find(c=>c.id===this.pagoCuentaId);
    return importeValido(this.pagoMonto) && !!cuenta && cuenta.moneda===this.pagoPrestamo?.moneda
      && this.pagoMonto<=Number(cuenta.saldo || 0) && this.pagoMonto<=Number(this.pagoPrestamo?.saldoPendiente || 0);
  }
  confirmarPago(): void {
    if (this.pagoEnCurso || !this.pagoValido || !this.pagoPrestamo?.id || !this.pagoCuentaId || this.pagoMonto <= 0) return;
    this.pagoEnCurso = true;
    this.prestamoSvc.pagar(this.pagoPrestamo.id, this.pagoMonto, this.pagoCuentaId, this.pagoOperacionId).subscribe({
      next: () => { this.pagoEnCurso=false; this.cerrarModal(); this.mostrarMensaje('Pago registrado correctamente.'); this.cargarPrestamos(); this.cargarMisCuentas(); },
      error: (err) => { this.pagoEnCurso=false; this.mostrarMensaje(err.error?.message || 'Error al registrar el pago. Reintente sin cerrar el formulario.', true); }
    });
  }

  calcularCuota(): number {
    if (!this.importesValidos) return 0;
    const P = +this.form.montoSolicitado;
    const i = +this.form.tasaInteres / 12 / 100;
    const n = +this.form.plazoMeses;
    if (i === 0) return P / n;
    return Math.round(P * (i * Math.pow(1 + i, n)) / (Math.pow(1 + i, n) - 1) * 100) / 100;
  }
  ngOnDestroy(): void {this.consultaLista?.unsubscribe();this.cargaSolicitud?.unsubscribe();this.dialogRef?.close();}

  private mostrarMensaje(msg: string, error = false): void {
    this.mensaje = msg;
    this.esError = error;
    this.snackBar.open(msg, 'Cerrar', {
      duration: 4500,
      horizontalPosition: 'end',
      verticalPosition: 'top',
      panelClass: error ? ['snackbar-error'] : ['snackbar-success']
    });
    setTimeout(() => this.mensaje = '', 5000);
  }

  estadoClase(estado?: string): string {
    switch (estado) {
      case 'PENDIENTE': return 'status-pendiente';
      case 'EN_REVISION': return 'status-revision';
      case 'APROBADO':
      case 'DESEMBOLSADO': return 'status-aprobado';
      case 'PAGADO': return 'status-pagado';
      case 'RECHAZADO':
      case 'VENCIDO': return 'status-rechazado';
      default: return 'status-default';
    }
  }

  private abrirDialogo(): void {
    this.abrirDialogoTemplate(this.loanDialogTpl);
  }

  private abrirDialogoTemplate(template: TemplateRef<unknown>): void {
    this.dialogRef?.close();
    this.dialogRef = this.dialog.open(template, {
      width: 'min(92vw, 840px)',
      maxWidth: '840px',
      autoFocus: false,
      disableClose: true
    });

    this.dialogRef.afterClosed().subscribe(() => {
      this.dialogRef = null;
      this.guardando = false;
    });
  }

  private formVacio(): Prestamo {
    return {
      usuarioId: 0, cuentaDesembolsoId: 0,
      montoSolicitado: 0, tasaInteres: 18, plazoMeses: 12,
      tipoPrestamo: 'PERSONAL', moneda: 'PEN'
    };
  }
}
