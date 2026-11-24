import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const api = req.url.startsWith('/api/') || /^http:\/\/localhost:808[1-4]\/api\//.test(req.url);
  const token = api && auth.isLoggedIn() ? auth.getToken() : null;
  const outgoing = token ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req;
  return next(outgoing).pipe(catchError(error => {
    if (api && error.status === 401 && !req.url.endsWith('/login')) {
      auth.logout(); void router.navigate(['/login']);
    }
    return throwError(() => error);
  }));
};
