import { Routes } from '@angular/router';
import { authGuard, adminGuard } from './guards/auth.guard';

export const routes: Routes = [
  { path: '', redirectTo: 'login', pathMatch: 'full' },
  {
    path: 'login',
    loadComponent: () =>
      import('./pages/login/login.component').then(m => m.LoginComponent)
  },
  {
    path: 'registro',
    loadComponent: () =>
      import('./pages/registro/registro.component').then(m => m.RegistroComponent)
  },
  {
    path: 'forgot-password',
    loadComponent: () =>
      import('./pages/forgot-password/forgot-password.component').then(m => m.ForgotPasswordComponent)
  },
  {
    path: 'reset-password',
    loadComponent: () =>
      import('./pages/reset-password/reset-password.component').then(m => m.ResetPasswordComponent)
  },
  {
    path: 'reset-password/:token',
    loadComponent: () =>
      import('./pages/reset-password/reset-password.component').then(m => m.ResetPasswordComponent)
  },
  {
    path: 'dashboard',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./pages/dashboard/dashboard.component').then(m => m.DashboardComponent)
  },
  {
    path: 'notificaciones',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/notificaciones/notificaciones.component').then(m => m.NotificacionesComponent)
  },
  {
    path: 'usuarios',
    canActivate: [authGuard, adminGuard],
    loadComponent: () =>
      import('./pages/usuarios/usuarios.component').then(m => m.UsuariosComponent)
  },
  {
    path: 'auditoria',
    canActivate: [authGuard, adminGuard],
    loadComponent: () =>
      import('./pages/auditoria/auditoria.component').then(m => m.AuditoriaComponent)
  },
  {
    path: 'alertas',
    canActivate: [authGuard, adminGuard],
    loadComponent: () =>
      import('./pages/alertas/alertas.component').then(m => m.AlertasComponent)
  },
  {
    path: 'cuentas',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./pages/cuentas/cuentas.component').then(m => m.CuentasComponent)
  },
  {
    path: 'transacciones',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./pages/transacciones/transacciones.component').then(m => m.TransaccionesComponent)
  },
  {
    path: 'transacciones/:id',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/transacciones/transaccion-detalle.component').then(m => m.TransaccionDetalleComponent)
  },
  {
    path: 'prestamos',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./pages/prestamos/prestamos.component').then(m => m.PrestamosComponent)
  },
  {
    path: 'prestamos/:id',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/prestamos/prestamo-detalle.component').then(m => m.PrestamoDetalleComponent)
  },
  { path: '**', redirectTo: 'login' }
];
