import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { PrestamosComponent } from './prestamos.component';
import { AuthService } from '../../services/auth.service';
import { environment } from '../../../environments/environment';

describe('Loan request review and recovery', () => {
  let page: PrestamosComponent;
  let http: HttpTestingController;
  const storageKey = 'fintech_solicitud_2';
  beforeEach(() => {
    TestBed.configureTestingModule({imports:[PrestamosComponent,HttpClientTestingModule],
      providers:[provideRouter([]),provideNoopAnimations(),{provide:AuthService,useValue:{getSession:()=>({usuarioId:2,rol:'ADMIN'})}}]});
    page=TestBed.createComponent(PrestamosComponent).componentInstance;
    http=TestBed.inject(HttpTestingController);
    sessionStorage.removeItem(storageKey);
    page.form={usuarioId:2,cuentaDesembolsoId:3,montoSolicitado:500,tasaInteres:18,plazoMeses:3,tipoPrestamo:'PERSONAL',moneda:'PEN'};
    page.misCuentas=[{id:3,usuarioId:2,numeroCuenta:'FT12345678',tipoCuenta:'AHORROS',estado:'ACTIVA',saldo:0,moneda:'PEN'}];
  });
  afterEach(()=>{sessionStorage.removeItem(storageKey);http.verify();});

  it('shows rounded costs only for valid decimal amounts and whole-month terms',()=>{
    expect(page.calcularCuota()).toBe(171.69);expect(page.totalEstimado).toBe(515.07);expect(page.interesesEstimados).toBe(15.07);
    page.form.plazoMeses=3.5;expect(page.importesValidos).toBeFalse();expect(page.calcularCuota()).toBe(0);
    page.form.plazoMeses=3;page.form.montoSolicitado=500.001;expect(page.importesValidos).toBeFalse();
    page.form.montoSolicitado=500;page.form.tasaInteres=100.01;expect(page.importesValidos).toBeFalse();
    page.form.montoSolicitado=9999999999999.99;page.form.tasaInteres=18;page.form.plazoMeses=360;
    expect(page.totalExcedeMaximo).toBeTrue();expect(page.solicitudValida).toBeFalse();
  });
  it('requires review and an active account owned by the selected client',()=>{
    page.guardar();http.expectNone(environment.msPrestamosUrl);
    page.misCuentas[0].usuarioId=9;page.revisarSolicitud();expect(page.revisandoSolicitud).toBeFalse();
    page.misCuentas[0].usuarioId=2;page.revisarSolicitud();expect(page.revisandoSolicitud).toBeTrue();expect(page.form.numeroCuenta).toBe('FT12345678');
    http.expectNone(environment.msPrestamosUrl);
  });
  it('cancels an obsolete account query after switching clients and derives the new currency',()=>{
    page.cambiarCliente();const old=http.expectOne(environment.msCuentasUrl+'/usuario/2');
    page.form.usuarioId=7;page.cambiarCliente();expect(old.cancelled).toBeTrue();
    http.expectOne(environment.msCuentasUrl+'/usuario/7').flush([{id:8,usuarioId:7,moneda:'USD',estado:'ACTIVA'}]);
    page.form.cuentaDesembolsoId=8;page.cambiarCuenta();expect(page.form.moneda).toBe('USD');expect(page.cargandoCuentas).toBeFalse();
  });
  it('preserves the original key and payload after losing the response, including a failed access retry',()=>{
    page.revisarSolicitud();const key=page.solicitudId;page.guardar();page.guardar();
    const first=http.expectOne(environment.msPrestamosUrl);expect(first.request.headers.get('Idempotency-Key')).toBe(key);
    first.flush({},{status:503,statusText:'Unavailable'});
    page.volverSolicitud();expect(page.revisandoSolicitud).toBeTrue();
    expect(JSON.parse(sessionStorage.getItem(storageKey)!).clave).toBe(key);
    page.guardar();const retry=http.expectOne(environment.msPrestamosUrl);
    expect(retry.request.body).toEqual(first.request.body);expect(retry.request.headers.get('Idempotency-Key')).toBe(key);
    retry.flush({},{status:403,statusText:'Forbidden'});expect(page.resultadoSolicitudIncierto).toBeTrue();
  });
  it('retains entered data and allows editing after an explicit initial validation rejection',()=>{
    page.revisarSolicitud();page.guardar();http.expectOne(environment.msPrestamosUrl).flush({message:'Cuenta bloqueada'},{status:400,statusText:'Bad request'});
    expect(page.form.montoSolicitado).toBe(500);expect(page.revisandoSolicitud).toBeFalse();expect(page.formError).toContain('bloqueada');
    expect(sessionStorage.getItem(storageKey)).toBeNull();
  });
});
