import { TestBed, ComponentFixture } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { AuditoriaComponent } from './auditoria.component';
import { environment } from '../../../environments/environment';

describe('Audit consultation failure and recovery',()=>{
  let fixture:ComponentFixture<AuditoriaComponent>;
  let http:HttpTestingController;
  beforeEach(()=>{
    TestBed.configureTestingModule({imports:[AuditoriaComponent,HttpClientTestingModule],providers:[provideNoopAnimations()]});
    fixture=TestBed.createComponent(AuditoriaComponent);http=TestBed.inject(HttpTestingController);fixture.detectChanges();
  });
  afterEach(()=>{fixture.destroy();http.verify();});
  it('shows an unavailable journal as an error and recovers using the retry button',()=>{
    http.expectOne(r=>r.url===environment.msAuditoriaUrl).flush({},{status:503,statusText:'Unavailable'});fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="alert"]')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.empty')).toBeNull();
    const button=fixture.nativeElement.querySelector('[role="alert"] button') as HTMLButtonElement;button.click();
    http.expectOne(r=>r.url===environment.msAuditoriaUrl).flush({content:[{id:1,accion:'ACTIVACION_CUENTA',entidadAfectada:'CUENTA',entidadId:1,usuarioEjecutor:'admin',rolEjecutor:'ADMIN',fechaRegistro:'2026-11-17T12:00:00'}],totalElements:1,totalPages:1});
    fixture.detectChanges();expect(fixture.componentInstance.errorCarga).toBe('');expect(fixture.componentInstance.eventos.length).toBe(1);
  });
  it('cancels obsolete queries when filters change',()=>{
    const old=http.expectOne(r=>r.url===environment.msAuditoriaUrl);
    fixture.componentInstance.filtroUsuario='administrador';fixture.componentInstance.buscar();expect(old.cancelled).toBeTrue();
    http.expectOne(r=>r.url===environment.msAuditoriaUrl&&r.params.get('usuarioEjecutor')==='administrador')
      .flush({content:[],totalElements:0,totalPages:0});
    expect(fixture.componentInstance.errorCarga).toBe('');
  });
});
