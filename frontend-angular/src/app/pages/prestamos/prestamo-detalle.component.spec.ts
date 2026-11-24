import { of, throwError, BehaviorSubject, Subject } from 'rxjs';
import { PrestamoDetalleComponent } from './prestamo-detalle.component';

describe('Loan detail payment recovery',()=>{
  let component:PrestamoDetalleComponent;
  let api:any;
  let parametros:BehaviorSubject<any>;
  const key='fintech_pago_2_7';
  const detail=()=>({prestamo:{id:7,usuarioId:2,estado:'DESEMBOLSADO',saldoPendiente:100,moneda:'PEN'},pagos:[],cuotas:[],saldoVencido:0,importeProximaCuota:50}) as any;
  beforeEach(()=>{
    sessionStorage.removeItem(key);
    api={getDetalle:jasmine.createSpy().and.returnValue(of(detail())),pagar:jasmine.createSpy().and.returnValue(throwError(()=>({status:503}))),cancelar:jasmine.createSpy()};
    parametros=new BehaviorSubject({get:()=> '7'});
    component=new PrestamoDetalleComponent({paramMap:parametros} as any,api,{getByUsuario:()=>of([{id:3,estado:'ACTIVA',moneda:'PEN',saldo:200}])} as any,{getSession:()=>({usuarioId:2,rol:'CLIENTE'})} as any);
    component.ngOnInit();
  });
  afterEach(()=>{component.ngOnDestroy();sessionStorage.removeItem(key);sessionStorage.removeItem('fintech_pago_2_8');});
  it('retains the same operation after an ambiguous failure and reload',()=>{
    component.abrirPago();const id=component.operacionId;
    component.pagar();expect(component.resultadoIncierto).toBeTrue();
    component.mostrarPago=false;component.cargar();
    expect(component.operacionId).toBe(id);expect(component.monto).toBe(50);
    component.pagar();expect(api.pagar.calls.mostRecent().args).toEqual([7,50,3,id]);
  });
  it('clears a pending operation already confirmed in payment history',()=>{
    sessionStorage.setItem(key,JSON.stringify({operacionId:'abc',monto:100,cuentaId:3}));
    const d=detail();d.prestamo.estado='PAGADO';d.prestamo.saldoPendiente=0;d.pagos=[{operacionId:'prestamo:7:pago:abc'}];
    api.getDetalle.and.returnValue(of(d));component.cargar();
    expect(sessionStorage.getItem(key)).toBeNull();expect(component.mostrarPago).toBeFalse();expect(component.puedePagar).toBeFalse();
  });
  it('rejects an amount above available funds or the debt before sending',()=>{
    component.abrirPago();component.monto=101;component.pagar();
    expect(component.pagoValido).toBeFalse();expect(api.pagar).not.toHaveBeenCalled();
  });
  it('loads another linked loan and keeps a late payment response scoped to its original loan',()=>{
    const response=new Subject<any>();api.pagar.and.returnValue(response);
    component.abrirPago();component.pagar();
    sessionStorage.setItem('fintech_pago_2_8',JSON.stringify({operacionId:'another-payment',monto:25,cuentaId:3}));
    const other=detail();other.prestamo.id=8;api.getDetalle.and.returnValue(of(other));parametros.next({get:()=> '8'});
    response.next({});
    expect(component.detalle?.prestamo.id).toBe(8);expect(component.monto).toBe(25);
    expect(sessionStorage.getItem('fintech_pago_2_8')).not.toBeNull();expect(sessionStorage.getItem(key)).toBeNull();
  });
});
