import { TestBed, ComponentFixture } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { AlertasComponent } from './alertas.component';
import { environment } from '../../../environments/environment';
import { Alerta } from '../../models/models';

describe('Admin alert decisions',()=>{
  let fixture:ComponentFixture<AlertasComponent>;let page:AlertasComponent;let http:HttpTestingController;
  const url=environment.msTransaccionesUrl.replace('/api/transacciones','/api/alertas');
  const alerta:Alerta={id:8,tipoAlerta:'MONTO_ELEVADO',nivelRiesgo:'ALTO',estado:'PENDIENTE',numeroCuenta:'FT00000008',descripcion:'Importe elevado',fechaDeteccion:'2026-11-17T12:00:00'};
  const empty={content:[],totalElements:0,totalPages:0};
  beforeEach(()=>{
    TestBed.configureTestingModule({imports:[AlertasComponent,HttpClientTestingModule],providers:[provideNoopAnimations()]});
    fixture=TestBed.createComponent(AlertasComponent);page=fixture.componentInstance;http=TestBed.inject(HttpTestingController);fixture.detectChanges();
  });
  afterEach(()=>{fixture.destroy();http.verify();});
  it('distinguishes failed loading from an empty list and retries',()=>{
    http.expectOne(r=>r.url===url).flush({},{status:503,statusText:'Unavailable'});fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="alert"]')).not.toBeNull();expect(fixture.nativeElement.querySelector('.empty')).toBeNull();
    fixture.nativeElement.querySelector('[role="alert"] button').click();http.expectOne(r=>r.url===url).flush(empty);fixture.detectChanges();
    expect(page.errorCarga).toBe('');expect(fixture.nativeElement.querySelector('.empty')).not.toBeNull();
  });
  it('cancels a prior filter request',()=>{
    const previous=http.expectOne(r=>r.url===url);page.nivel='ALTO';page.buscar();expect(previous.cancelled).toBeTrue();
    http.expectOne(r=>r.url===url&&r.params.get('nivelRiesgo')==='ALTO').flush(empty);
  });
  it('keeps the decision and reason after failure and sends only once on double submit',()=>{
    http.expectOne(r=>r.url===url).flush(empty);page.resolver(alerta,'DESCARTADA');page.observacion='Revisada con el cliente';
    expect(page.tituloAccion).toBe('Descartar alerta');page.confirmarAccion();page.confirmarAccion();page.cerrarModal();
    expect(page.alertaAccion).toBe('DESCARTAR');const request=http.expectOne(url+'/8/resolver');expect(request.request.body.estado).toBe('DESCARTADA');
    request.flush({message:'La alerta ya fue cerrada'},{status:409,statusText:'Conflict'});http.expectOne(r=>r.url===url).flush(empty);
    expect(page.guardando).toBeFalse();expect(page.observacion).toBe('Revisada con el cliente');expect(page.errorAccion).toContain('cerrada');
  });
  it('requires a bounded reason and explains that a block affects the account',()=>{
    http.expectOne(r=>r.url===url).flush(empty);page.bloquear(alerta);expect(page.descripcionAccion).toContain('débitos');
    page.observacion=' '.repeat(3);page.confirmarAccion();page.observacion='x'.repeat(1001);page.confirmarAccion();http.expectNone(url+'/8/bloquear-cuenta');
    page.observacion='Patrón confirmado';page.confirmarAccion();http.expectOne(r=>r.url===url+'/8/bloquear-cuenta'&&r.params.get('observacion')==='Patrón confirmado').flush({...alerta,estado:'RESUELTA'});
    http.expectOne(r=>r.url===url).flush(empty);expect(page.alertaAccion).toBe('');
  });
  it('returns to the last valid page after resolving its final alert',()=>{
    http.expectOne(r=>r.url===url).flush(empty);page.pagina=2;page.cargar();http.expectOne(r=>r.url===url&&r.params.get('page')==='2').flush({...empty,totalPages:2});
    http.expectOne(r=>r.url===url&&r.params.get('page')==='1').flush({...empty,totalPages:2});expect(page.pagina).toBe(1);
  });
});
