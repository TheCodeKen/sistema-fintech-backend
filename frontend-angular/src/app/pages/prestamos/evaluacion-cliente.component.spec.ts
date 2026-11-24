import { of, Subject, throwError } from 'rxjs';
import { EvaluacionClienteComponent } from './evaluacion-cliente.component';

describe('Internal loan history and manual decision',()=>{
  let page:EvaluacionClienteComponent;
  let api:any;
  const data=(estado='EN_REVISION')=>({solicitud:{id:7,estado},fechaCorte:'2026-11-17',totalOtrosPrestamos:0,porEstado:{},saldos:[],prestamosSinCronograma:0,prestamosRecientes:[],totalPagos:0,pagosRecientes:[]});
  beforeEach(()=>{
    api={getEvaluacion:jasmine.createSpy().and.returnValue(of(data())),aprobar:jasmine.createSpy(),rechazar:jasmine.createSpy(),revisar:jasmine.createSpy()};
    page=new EvaluacionClienteComponent(api);page.prestamo={id:7,estado:'EN_REVISION'} as any;page.ngOnChanges();
  });
  afterEach(()=>page.ngOnDestroy());
  it('requires acknowledgement, a decision and a meaningful observation even with no prior history',()=>{
    expect(page.datos?.totalOtrosPrestamos).toBe(0);expect(page.puedeConfirmar).toBeFalse();
    page.decision='APROBAR';page.observacion='Revisados los antecedentes internos';expect(page.puedeConfirmar).toBeFalse();
    page.revisado=true;expect(page.puedeConfirmar).toBeTrue();
  });
  it('sends the observation once and freezes repeated confirmation while pending',()=>{
    const response=new Subject<any>();api.aprobar.and.returnValue(response);
    page.revisado=true;page.decision='APROBAR';page.observacion='  Documentación y antecedentes revisados  ';
    page.confirmarDecision();page.confirmarDecision();expect(api.aprobar).toHaveBeenCalledOnceWith(7,'Documentación y antecedentes revisados');
    expect(page.enviando).toBeTrue();
  });
  it('distinguishes an unavailable history from an empty history and blocks decisions',()=>{
    api.getEvaluacion.and.returnValue(throwError(()=>({status:503})));page.cargar();
    page.revisado=true;page.decision='APROBAR';page.observacion='Intento de evaluación';page.confirmarDecision();
    expect(page.datos).toBeNull();expect(page.error).toContain('No pudimos cargar');expect(api.aprobar).not.toHaveBeenCalled();
  });
  it('fetches older history pages and resets the review acknowledgement',()=>{
    page.revisado=true;page.cargar(1);
    expect(api.getEvaluacion).toHaveBeenCalledWith(7,1);expect(page.revisado).toBeFalse();
  });
  it('preserves the observation after losing a decision response and refreshes its actual state',()=>{
    api.aprobar.and.returnValue(throwError(()=>({status:0})));
    page.revisado=true;page.decision='APROBAR';page.observacion='Evaluación manual revisada';page.confirmarDecision();
    expect(page.observacion).toBe('Evaluación manual revisada');expect(page.puedeConfirmar).toBeFalse();
    api.getEvaluacion.and.returnValue(of(data('APROBADO')));page.cargar();
    expect(page.datos?.solicitud.estado).toBe('APROBADO');expect(page.puedeConfirmar).toBeFalse();
  });
});
