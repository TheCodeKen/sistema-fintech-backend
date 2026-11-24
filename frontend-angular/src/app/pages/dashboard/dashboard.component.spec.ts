import { TestBed, ComponentFixture } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { DashboardComponent } from './dashboard.component';
import { AuthService } from '../../services/auth.service';
import { environment as env } from '../../../environments/environment';

for(const role of ['ADMIN','CLIENTE']){
  describe(`Dashboard ${role} availability`,()=>{
    let fixture:ComponentFixture<DashboardComponent>;let http:HttpTestingController;
    beforeEach(()=>{
      TestBed.configureTestingModule({imports:[DashboardComponent,HttpClientTestingModule],providers:[provideRouter([]),{provide:AuthService,useValue:{getSession:()=>({usuarioId:2,nombre:'Ana',rol:role})}}]});
      fixture=TestBed.createComponent(DashboardComponent);http=TestBed.inject(HttpTestingController);fixture.detectChanges();
    });
    afterEach(()=>{fixture.destroy();http.verify();});
    it('never displays initial zero amounts as a confirmed balance',()=>{
      expect(fixture.nativeElement.querySelector('.kpi-grid')).toBeNull();expect(fixture.nativeElement.querySelector('[role="status"]')).not.toBeNull();
      http.match(()=>true).forEach(r=>{if(!r.cancelled)r.flush({},{status:503,statusText:'Unavailable'});});fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('.kpi-grid')).toBeNull();expect(fixture.nativeElement.querySelector('[role="alert"]')).not.toBeNull();
    });
    it('cancels all pending requests on navigation',()=>{
      const pending=http.match(()=>true);fixture.destroy();pending.forEach(r=>expect(r.cancelled).toBeTrue());
    });
    if(role==='ADMIN'){
      it('does not treat a successful bank summary as proof that audit is available',()=>{
        http.expectOne(env.msUsuariosMetricasUrl).flush({activos:5,inactivos:1});
        http.expectOne(env.msCuentasMetricasUrl).flush({saldoPen:100,saldoUsd:20,porEstado:{ACTIVA:2}});
        http.expectOne(env.msTransaccionesMetricasUrl).flush({cantidadHoy:3,montoHoy:30});
        http.expectOne(env.msPrestamosMetricasUrl).flush({pendientesAtencion:1});
        http.expectOne(r=>r.url===env.msTransaccionesUrl).flush({content:[]});
        http.expectOne(r=>r.url===env.msAuditoriaUrl).flush({},{status:503,statusText:'Unavailable'});
        expect(fixture.componentInstance.microservicios[4].ok).toBeFalse();expect(fixture.componentInstance.errorMetricas).toBe('');
      });
    }else{
      it('recovers the summary with separate currencies and counts a transfer only once',()=>{
        http.expectOne(env.msCuentasUrl+'/usuario/2').flush({},{status:503,statusText:'Unavailable'});
        const cancelled=http.expectOne(env.msPrestamosUrl+'/usuario/2');expect(cancelled.cancelled).toBeTrue();
        fixture.componentInstance.cargarDatosCliente();
        http.expectOne(env.msCuentasUrl+'/usuario/2').flush([{id:1,estado:'ACTIVA',moneda:'PEN',saldo:100},{id:2,estado:'ACTIVA',moneda:'USD',saldo:20},{id:3,estado:'BLOQUEADA',moneda:'PEN',saldo:90}]);
        http.expectOne(env.msPrestamosUrl+'/usuario/2').flush([]);
        http.expectOne(env.msTransaccionesUrl+'/cuenta/1').flush([{id:1}]);
        http.expectOne(env.msTransaccionesUrl+'/cuenta/2').flush([{id:1}]);
        http.expectOne(env.msTransaccionesUrl+'/cuenta/3').flush([]);
        const page=fixture.componentInstance;expect(page.misCuentas).toBe(3);expect(page.miSaldo).toBe(100);expect(page.miSaldoUsd).toBe(20);expect(page.misTransacciones).toBe(1);expect(page.errorCliente).toBe('');
      });
    }
  });
}
