import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { TransaccionService } from '../../services/transaccion.service';
import { environment } from '../../../environments/environment';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { TransaccionesComponent } from './transacciones.component';
import { AuthService } from '../../services/auth.service';
describe('Movement review before confirmation', () => {
  let page: TransaccionesComponent;
  let http:HttpTestingController;
  beforeEach(() => {
    TestBed.configureTestingModule({imports:[TransaccionesComponent,HttpClientTestingModule],providers:[provideRouter([]),provideNoopAnimations(),{
      provide:AuthService,useValue:{getSession:()=>({usuarioId:2,rol:'CLIENTE'})}
    }]});
    page=TestBed.createComponent(TransaccionesComponent).componentInstance;
    http=TestBed.inject(HttpTestingController);sessionStorage.removeItem('fintech_movimiento_2');
    page.cuentasDisponibles=[{id:1,usuarioId:2,numeroCuenta:'FT12345678',tipoCuenta:'AHORROS',saldo:20,moneda:'PEN',estado:'ACTIVA'}];
    page.form.numeroCuentaOrigen='FT12345678';page.seleccionarOrigen();
  });
  afterEach(()=>{sessionStorage.removeItem('fintech_movimiento_2');http.verify();});
  it('derives currency and account ID from the selected account',()=>{
    expect(page.form.moneda).toBe('PEN');expect(page.form.cuentaOrigenId).toBe(1);
  });
  it('rejects a withdrawal greater than the available balance',()=>{
    page.form.tipoTransaccion='RETIRO';page.form.monto=21;page.revisarOperacion();
    expect(page.revisando).toBeFalse();expect(page.formError).toContain('saldo');
  });
  it('rejects a transfer to the same account',()=>{
    page.form.tipoTransaccion='TRANSFERENCIA';page.form.numeroCuentaDestino='FT12345678';page.form.monto=10;
    page.revisarOperacion();expect(page.revisando).toBeFalse();expect(page.formError).toContain('diferente');
  });
  it('requires reviewing a valid movement before it can be submitted',()=>{
    page.form.tipoTransaccion='RETIRO';page.form.monto=10;page.revisarOperacion();
    http.expectOne(environment.msTransaccionesUrl+'/revisar').flush({numeroCuentaOrigen:'FT12345678',moneda:'PEN',monto:10,saldoDisponible:20,saldoEstimado:10});
    expect(page.revisando).toBeTrue();expect(page.formError).toBe('');
    page.volverEditar();expect(page.revisando).toBeFalse();
  });
  it('does not send money when destination validation fails',()=>{
    page.form.tipoTransaccion='TRANSFERENCIA';page.form.numeroCuentaDestino='FT87654321';page.form.monto=10;page.revisarOperacion();
    http.expectOne(environment.msTransaccionesUrl+'/revisar').flush({message:'La cuenta destino no está activa'},{status:409,statusText:'Conflict'});
    expect(page.revisando).toBeFalse();expect(page.formError).toContain('destino');
    http.expectNone(environment.msTransaccionesUrl);
  });
  it('ignores a preview returned after the form was edited',()=>{
    page.form.tipoTransaccion='RETIRO';page.form.monto=10;page.revisarOperacion();page.form.monto=15;
    http.expectOne(environment.msTransaccionesUrl+'/revisar').flush({saldoDisponible:20,saldoEstimado:10});
    expect(page.revisando).toBeFalse();
  });
  it('preserves the exact request and key after an ambiguous failure',()=>{
    page.form.tipoTransaccion='RETIRO';page.form.monto=10;page.revisando=true;const key=page.operacionId;
    page.guardar();const first=http.expectOne(environment.msTransaccionesUrl);
    expect(first.request.headers.get('Idempotency-Key')).toBe(key);
    first.flush({message:'Resultado pendiente'},{status:503,statusText:'Unavailable'});
    page.volverEditar();expect(page.revisando).toBeTrue();expect(page.resultadoIncierto).toBeTrue();
    const stored=JSON.parse(sessionStorage.getItem('fintech_movimiento_2')!);expect(stored.operacionId).toBe(key);expect(stored.movimiento.monto).toBe(10);
    page.guardar();const retry=http.expectOne(environment.msTransaccionesUrl);expect(retry.request.headers.get('Idempotency-Key')).toBe(key);expect(retry.request.body).toEqual(first.request.body);
    retry.flush({message:'Acceso no disponible'},{status:403,statusText:'Forbidden'});
    expect(page.resultadoIncierto).toBeTrue();expect(JSON.parse(sessionStorage.getItem('fintech_movimiento_2')!).operacionId).toBe(key);
  });
  it('suggests only other active accounts in the selected currency without restricting manual destinations',()=>{
    const origin=page.cuentasDisponibles[0];
    page.cuentasDisponibles.push({...origin,id:3,numeroCuenta:'FT11112222'},{...origin,id:4,numeroCuenta:'FT33334444',moneda:'USD'});
    expect(page.cuentasDestinoDisponibles.map(c=>c.id)).toEqual([3]);
    page.form.tipoTransaccion='TRANSFERENCIA';page.form.numeroCuentaDestino='FT33334444';page.form.monto=1;
    expect(page.errorDestino).toContain('moneda');page.revisarOperacion();http.expectNone(environment.msTransaccionesUrl+'/revisar');
    page.form.numeroCuentaDestino='FT99998888';expect(page.errorEdicion).toBe('');
  });
  it('rejects invalid precision locally and allows spending the exact available balance',()=>{
    page.form.tipoTransaccion='TRANSFERENCIA';page.form.numeroCuentaDestino='FT87654321';page.form.monto=1.001;
    expect(page.errorEdicion).toContain('decimales');
    page.form.monto=20;expect(page.errorEdicion).toBe('');
    page.form.monto=20.01;expect(page.errorEdicion).toContain('saldo');
  });
  it('clears a stale destination when switching away from transfers',()=>{
    page.form.tipoTransaccion='TRANSFERENCIA';page.form.numeroCuentaDestino='FT87654321';page.revision={} as any;
    page.form.tipoTransaccion='DEPOSITO';page.cambiarMovimiento();
    expect(page.form.numeroCuentaDestino).toBeUndefined();expect(page.revision).toBeNull();
  });
  it('refreshes the balance and invalidates the previous preview without losing entered data',()=>{
    page.form.tipoTransaccion='RETIRO';page.form.monto=15;page.revisando=true;page.revision={} as any;
    page.cargarCuentasFormulario();expect(page.cargandoCuentas).toBeTrue();expect(page.revisando).toBeFalse();
    page.revisarOperacion();http.expectNone(environment.msTransaccionesUrl+'/revisar');
    http.expectOne(environment.msCuentasUrl+'/usuario/2').flush([{...page.cuentasDisponibles[0],saldo:10}]);
    expect(page.cargandoCuentas).toBeFalse();expect(page.form.monto).toBe(15);expect(page.errorEdicion).toContain('saldo');expect(page.revision).toBeNull();
  });
  it('never changes a pending request or its key when refreshing accounts',()=>{
    page.form.monto=10;page.form.moneda='PEN';page.resultadoIncierto=true;page.revisando=true;const before=JSON.stringify(page.form),key=page.operacionId;
    page.cargarCuentasFormulario();http.expectOne(environment.msCuentasUrl+'/usuario/2').flush([]);
    expect(JSON.stringify(page.form)).toBe(before);expect(page.operacionId).toBe(key);expect(page.revisando).toBeTrue();
  });
  it('sends a single preview and a single confirmation on repeated clicks',()=>{
    page.form.tipoTransaccion='RETIRO';page.form.monto=10;page.revisarOperacion();page.revisarOperacion();
    http.expectOne(environment.msTransaccionesUrl+'/revisar').flush({saldoDisponible:20,saldoEstimado:10});
    page.guardar();page.guardar();const req=http.expectOne(environment.msTransaccionesUrl);
    req.flush({message:'No response confirmed'},{status:503,statusText:'Unavailable'});
    expect(page.resultadoIncierto).toBeTrue();
  });
  it('releases a stalled read-only preview without creating or persisting a transaction',fakeAsync(()=>{
    page.form.tipoTransaccion='RETIRO';page.form.monto=10;page.revisarOperacion();
    const req=http.expectOne(environment.msTransaccionesUrl+'/revisar');tick(15001);
    expect(req.cancelled).toBeTrue();expect(page.validando).toBeFalse();expect(page.formError).toContain('No se envió');
    expect(sessionStorage.getItem('fintech_movimiento_2')).toBeNull();http.expectNone(environment.msTransaccionesUrl);
  }));
  it('keeps the exact operation after a confirmation timeout so retry uses the same key',fakeAsync(()=>{
    page.form.tipoTransaccion='RETIRO';page.form.monto=10;page.revisando=true;const key=page.operacionId;
    page.guardar();const req=http.expectOne(environment.msTransaccionesUrl);tick(30001);
    expect(req.cancelled).toBeTrue();expect(page.guardando).toBeFalse();expect(page.resultadoIncierto).toBeTrue();
    expect(JSON.parse(sessionStorage.getItem('fintech_movimiento_2')!).operacionId).toBe(key);
    page.guardar();const retry=http.expectOne(environment.msTransaccionesUrl);
    expect(retry.request.body).toEqual(req.request.body);expect(retry.request.headers.get('Idempotency-Key')).toBe(key);
    retry.flush({estado:'PROCESANDO'});expect(page.resultadoIncierto).toBeTrue();
  }));
});
