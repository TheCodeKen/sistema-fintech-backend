import { TestBed, ComponentFixture, fakeAsync, tick } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { provideRouter } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { CuentasComponent } from './cuentas/cuentas.component';
import { PrestamosComponent } from './prestamos/prestamos.component';
import { TransaccionesComponent } from './transacciones/transacciones.component';
import { environment } from '../../environments/environment';

for(const role of ['ADMIN','CLIENTE']){
  for(const [component,url,reload] of [
    [CuentasComponent,environment.msCuentasUrl,'cargarCuentas'],
    [PrestamosComponent,environment.msPrestamosUrl,'cargarPrestamos'],
    [TransaccionesComponent,role==='ADMIN'?environment.msTransaccionesUrl:environment.msCuentasUrl,'cargarTransacciones']
  ] as const){
    describe(`${role}: loading failures in ${component.name}`,()=>{
      let fixture:ComponentFixture<any>;let http:HttpTestingController;
      beforeEach(()=>{
        TestBed.configureTestingModule({imports:[component,HttpClientTestingModule],providers:[provideNoopAnimations(),provideRouter([]),{provide:AuthService,useValue:{getSession:()=>({usuarioId:2,rol:role})}}]});
        fixture=TestBed.createComponent(component as any);http=TestBed.inject(HttpTestingController);fixture.detectChanges();
        http.match(r=>r.url!==url&&r.url!==url+'/usuario/2').forEach(r=>r.flush(r.request.url===environment.msUsuariosUrl?{content:[]}:[]));
      });
      afterEach(()=>{fixture.destroy();http.verify();});
      it('shows a retryable error and only shows an empty state after successful recovery',()=>{
        http.expectOne(r=>r.url===url||r.url===url+'/usuario/2').flush({},{status:503,statusText:'Unavailable'});fixture.detectChanges();
        expect(fixture.nativeElement.querySelector('[role="alert"]')).not.toBeNull();
        expect(fixture.nativeElement.textContent).not.toMatch(/No se encontraron|No tienes préstamos|No hay préstamos/);
        fixture.nativeElement.querySelector('[role="alert"] button').click();
        http.expectOne(r=>r.url===url||r.url===url+'/usuario/2').flush(role==='ADMIN'?{content:[],totalPages:0,totalElements:0}:[]);
        fixture.detectChanges();expect(fixture.nativeElement.querySelector('[role="alert"]')).toBeNull();expect(fixture.componentInstance.loading).toBeFalse();
      });
      it('cancels obsolete refreshes and cleans up on navigation',()=>{
        const old=http.expectOne(r=>r.url===url||r.url===url+'/usuario/2');fixture.componentInstance[reload]();expect(old.cancelled).toBeTrue();
        const latest=http.expectOne(r=>r.url===url||r.url===url+'/usuario/2');fixture.destroy();expect(latest.cancelled).toBeTrue();
      });
      it('stops an indefinitely stalled request and offers recovery',fakeAsync(()=>{
        const initial=http.expectOne(r=>r.url===url||r.url===url+'/usuario/2');fixture.componentInstance[reload]();expect(initial.cancelled).toBeTrue();
        const stalled=http.expectOne(r=>r.url===url||r.url===url+'/usuario/2');tick(15001);fixture.detectChanges();
        expect(stalled.cancelled).toBeTrue();expect(fixture.componentInstance.loading).toBeFalse();expect(fixture.nativeElement.querySelector('[role="alert"] button')).not.toBeNull();
      }));
    });
  }
}
