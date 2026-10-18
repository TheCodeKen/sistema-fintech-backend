import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';

@Component({
  selector: 'app-registro',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, MatButtonModule, MatCardModule,
            MatFormFieldModule, MatIconModule, MatInputModule],
  template: `
    <div class="auth-shell">
      <div class="auth-visual">
        <div class="auth-visual-badge">FinTechPro</div>
        <h1>Crea tu cuenta en segundos</h1>
        <p>Accede a cuentas, transferencias y préstamos desde un solo lugar. Registro gratuito.</p>
      </div>

      <mat-card class="auth-card">
        <div class="auth-brand">
          <div class="brand-mark"><mat-icon>account_balance</mat-icon></div>
          <div>
            <h2>FinTech<span>Pro</span></h2>
            <p>Crear cuenta nueva</p>
          </div>
        </div>

        <div *ngIf="error" class="alert alert-danger auth-alert">{{ error }}</div>
        <div *ngIf="exito" class="alert alert-success auth-alert">{{ exito }}</div>

        <form (ngSubmit)="onRegistro()" #regForm="ngForm" class="auth-form">
          <div class="form-row">
            <mat-form-field appearance="outline">
              <mat-label>Nombre</mat-label>
              <input matInput [(ngModel)]="form.nombre" name="nombre" placeholder="Juan"
                     required minlength="2" #nombreM="ngModel" />
              <mat-error *ngIf="nombreM.invalid && (nombreM.dirty || nombreM.touched)">Mínimo 2 caracteres.</mat-error>
            </mat-form-field>
            <mat-form-field appearance="outline">
              <mat-label>Apellido</mat-label>
              <input matInput [(ngModel)]="form.apellido" name="apellido" placeholder="Pérez"
                     required minlength="2" #apellidoM="ngModel" />
              <mat-error *ngIf="apellidoM.invalid && (apellidoM.dirty || apellidoM.touched)">Mínimo 2 caracteres.</mat-error>
            </mat-form-field>
          </div>

          <mat-form-field appearance="outline">
            <mat-label>Correo electrónico</mat-label>
            <input matInput type="email" [(ngModel)]="form.email" name="email"
                   placeholder="juan@correo.com" required email #emailM="ngModel" />
            <mat-error *ngIf="emailM.invalid && (emailM.dirty || emailM.touched)">Ingrese un correo válido.</mat-error>
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>Teléfono (opcional)</mat-label>
            <input matInput [(ngModel)]="form.telefono" name="telefono" placeholder="999 999 999" />
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>Contraseña</mat-label>
            <input matInput type="password" [(ngModel)]="form.password" name="password"
                   placeholder="••••••••" required minlength="6" #passM="ngModel" />
            <mat-error *ngIf="passM.errors?.['required'] && (passM.dirty || passM.touched)">La contraseña es obligatoria.</mat-error>
            <mat-error *ngIf="passM.errors?.['minlength'] && (passM.dirty || passM.touched)">Mínimo 6 caracteres.</mat-error>
          </mat-form-field>

          <button mat-raised-button color="primary" type="submit"
                  [disabled]="loading || regForm.invalid" class="auth-button">
            <mat-icon>person_add</mat-icon>
            {{ loading ? 'Creando cuenta...' : 'Crear cuenta' }}
          </button>

          <a mat-button routerLink="/login" class="forgot-link">¿Ya tienes cuenta? Inicia sesión</a>
        </form>
      </mat-card>
    </div>
  `,
  styles: [`
    :host { display: block; }

    .auth-shell {
      min-height: 100vh;
      display: grid;
      grid-template-columns: 1.1fr .9fr;
      background:
        radial-gradient(circle at top left, rgba(37, 99, 235, .14), transparent 30%),
        linear-gradient(135deg, #eff6ff 0%, #f8fbff 55%, #eef4fb 100%);
      padding: 24px;
      gap: 24px;
      align-items: center;
    }

    .auth-visual { color: #0f172a; max-width: 560px; padding: 24px; }

    .auth-visual-badge {
      display: inline-flex;
      padding: 8px 14px;
      border-radius: 999px;
      background: #e8f1ff;
      color: #1d4ed8;
      font-size: 12px;
      font-weight: 800;
      letter-spacing: .4px;
      text-transform: uppercase;
      margin-bottom: 16px;
    }

    .auth-visual h1 { font-size: clamp(28px, 4vw, 46px); line-height: 1.1; margin: 0 0 14px; font-weight: 800; }
    .auth-visual p  { color: #64748b; font-size: 16px; line-height: 1.6; margin: 0; }

    .auth-card {
      width: 100%;
      max-width: 480px;
      justify-self: end;
      border-radius: 24px;
      padding: 28px;
      box-shadow: 0 24px 70px rgba(15,23,42,.14);
    }

    .auth-brand { display: flex; align-items: center; gap: 14px; margin-bottom: 22px; }
    .brand-mark {
      width: 52px; height: 52px; border-radius: 16px;
      background: linear-gradient(135deg, #2563eb, #1d4ed8);
      color: #fff; display: grid; place-items: center; flex-shrink: 0;
    }
    .brand-mark mat-icon { font-size: 26px; width: 26px; height: 26px; }
    .auth-brand h2 { margin: 0; font-size: 24px; font-weight: 800; color: #0f172a; }
    .auth-brand h2 span { color: #2563eb; }
    .auth-brand p { margin: 2px 0 0; color: #64748b; font-size: 13px; }

    .auth-form { display: grid; gap: 14px; }
    .auth-form mat-form-field { width: 100%; }

    .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }

    .auth-button { width: 100%; min-height: 48px; border-radius: 14px; }
    .auth-button mat-icon { margin-right: 8px; }

    .forgot-link { justify-self: center; color: #2563eb; font-weight: 700; }
    .forgot-link:hover { text-decoration: underline; }
    .auth-alert { margin-bottom: 2px; }

    @media (max-width: 900px) {
      .auth-shell { grid-template-columns: 1fr; }
      .auth-card  { justify-self: stretch; max-width: 100%; }
      .form-row   { grid-template-columns: 1fr; }
    }
  `]
})
export class RegistroComponent {
  form = { nombre: '', apellido: '', email: '', password: '', telefono: '' };
  error = '';
  exito = '';
  loading = false;

  constructor(private auth: AuthService, private router: Router) {
    if (this.auth.isLoggedIn()) this.router.navigate(['/dashboard']);
  }

  onRegistro(): void {
    this.error = '';
    this.exito = '';
    this.loading = true;

    this.auth.register(this.form).subscribe({
      next: () => {
        this.exito = '¡Cuenta creada! Redirigiendo...';
        setTimeout(() => this.router.navigate(['/dashboard']), 1200);
      },
      error: (err) => {
        this.error = err.status === 409
          ? 'Ya existe una cuenta con ese correo.'
          : 'Error al crear la cuenta. Verifique que el servidor esté activo.';
        this.loading = false;
      }
    });
  }
}
