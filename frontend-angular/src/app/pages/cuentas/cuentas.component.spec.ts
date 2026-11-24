import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { CuentasComponent } from './cuentas.component';
import { AuthService } from '../../services/auth.service';
import { environment } from '../../../environments/environment';

describe('Account opening and state confirmation',()=>{
  let page:CuentasComponent;
  let http:HttpTestingController;
  const key='fintech_apertura_2';
  beforeEach(()=>{
    TestBed.configureTestingModule({imports:[CuentasComponent,HttpClientTestingModule],providers:[provideRouter([]),provideNoopAnimations(),
      {provide:AuthService,useValue:{getSession:()=>({usuarioId:2,rol:'ADMIN'})}}]});
    page=TestBed.createComponent(CuentasComponent).componentInstance;http=TestBed.inject(HttpTestingController);
    sessionStorage.removeItem(key);page.form={usuarioId:2,tipoCuenta:'AHORROS',saldoInicial:0,moneda:'PEN'};
  });
  afterEach(()=>{sessionStorage.removeItem(key);http.verify();});
  it('requires review before sending and rejects negative or overprecise opening balances',()=>{
    page.form.saldoInicial=-1;expect(page.aperturaValida).toBeFalse();page.form.saldoInicial=1.001;expect(page.aperturaValida).toBeFalse();
    page.form.saldoInicial=0;page.guardar();expect(page.revisandoApertura).toBeTrue();http.expectNone(environment.msCuentasUrl);
  });
  it('retains the exact opening after an ambiguous failure and sends only one request on double click',()=>{
    page.guardar();const id=page.aperturaId;page.guardar();page.guardar();
    const first=http.expectOne(environment.msCuentasUrl);expect(first.request.headers.get('Idempotency-Key')).toBe(id);
    first.flush({},{status:503,statusText:'Unavailable'});page.volverApertura();expect(page.revisandoApertura).toBeTrue();
    expect(JSON.parse(sessionStorage.getItem(key)!).clave).toBe(id);
    page.guardar();const retry=http.expectOne(environment.msCuentasUrl);expect(retry.request.body).toEqual(first.request.body);
    retry.flush({},{status:403,statusText:'Forbidden'});expect(page.resultadoAperturaIncierto).toBeTrue();
  });
  it('keeps entered data editable after an initial validation rejection',()=>{
    page.form.saldoInicial=25;page.guardar();page.guardar();http.expectOne(environment.msCuentasUrl).flush({message:'Titular inactivo'},{status:400,statusText:'Bad request'});
    expect(page.form.saldoInicial).toBe(25);expect(page.revisandoApertura).toBeFalse();expect(sessionStorage.getItem(key)).toBeNull();
  });
  it('does not replace an edited holder when a client list arrives late',()=>{
    page.requestedUsuarioId=7;page.cargarUsuarios();page.form.usuarioId=8;
    http.expectOne(r=>r.url===environment.msUsuariosUrl).flush({content:[{id:7},{id:8}]});
    expect(page.form.usuarioId).toBe(8);
  });
  it('blocks invalid reasons and retains the reason after a failed state change',()=>{
    page.cuentaPendiente={id:3,usuarioId:2,tipoCuenta:'AHORROS',estado:'ACTIVA',saldo:0,moneda:'PEN'};page.accionPendiente='bloquear';
    page.motivo='  no  ';page.confirmarEstado();http.expectNone(environment.msCuentasUrl+'/3/bloquear');
    page.motivo='Revisión de seguridad';page.confirmarEstado();page.confirmarEstado();
    http.expectOne(r=>r.url===environment.msCuentasUrl+'/3/bloquear').flush({message:'Servicio temporalmente caído'},{status:503,statusText:'Unavailable'});
    http.expectOne(r=>r.url===environment.msCuentasUrl&&r.method==='GET').flush({content:[],totalPages:0,totalElements:0});
    expect(page.cambiandoEstado).toBeFalse();expect(page.motivo).toBe('Revisión de seguridad');expect(page.errorEstadoCuenta).toContain('temporalmente');
  });
  it('does not send a close request while the visible balance is nonzero',()=>{
    page.cuentaPendiente={id:3,usuarioId:2,tipoCuenta:'AHORROS',saldo:1};page.accionPendiente='cerrar';page.confirmarEstado();
    http.expectNone(environment.msCuentasUrl+'/3/cerrar');expect(page.descripcionEstado).toContain('saldo debe ser cero');
  });
});
