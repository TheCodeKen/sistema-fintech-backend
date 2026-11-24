import { TestBed } from '@angular/core/testing';
import { provideZoneChangeDetection } from '@angular/core';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { AuthService } from '../services/auth.service';
import { routes } from '../app.routes';

describe('Application pages render with their real templates', () => {
  const session = { usuarioId: 2, nombre: 'Prueba', apellido: 'Local', rol: 'ADMIN', token: '' };
  for (const route of routes.filter(r => r.loadComponent && r.path !== 'reset-password/:token')) {
    it(`renders /${route.path} without dependency or template errors`, async () => {
      const component = await route.loadComponent!() as any;
      await TestBed.configureTestingModule({
        imports: [component, HttpClientTestingModule],
        providers: [provideRouter([]), provideZoneChangeDetection(), provideNoopAnimations(), {
          provide: AuthService,
          useValue: { getSession: () => session, isLoggedIn: () => false, getToken: () => null }
        }]
      }).compileComponents();
      const fixture = TestBed.createComponent(component);
      fixture.detectChanges();
      expect(fixture.nativeElement.textContent.trim().length).toBeGreaterThan(0);
      fixture.destroy();
    });
  }
});
