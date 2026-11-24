import { of, throwError } from 'rxjs';
import { NotificacionesComponent } from './notificaciones.component';
import { Notificacion } from '../../services/notificacion.service';

describe('Personal notification inbox',()=>{
  let page:NotificacionesComponent;let api:any;let router:any;
  const notification=(id:number,read=false):Notificacion=>({id,tipo:'MOVIMIENTO_CONFIRMADO',titulo:'Transferencia recibida',mensaje:'PEN 10.00',enlace:'/transacciones/5',fechaEvento:'2026-11-14T10:00:00',leidaEn:read?'2026-11-14T11:00:00':null});
  beforeEach(()=>{
    api={listar:jasmine.createSpy().and.returnValue(of({content:[notification(100)],totalPages:2})),actualizarContador:jasmine.createSpy().and.returnValue(of(1)),leer:jasmine.createSpy().and.returnValue(of(void 0)),leerTodas:jasmine.createSpy().and.returnValue(of(void 0))};
    router={navigateByUrl:jasmine.createSpy()};page=new NotificacionesComponent(api,router);page.ngOnInit();
  });
  afterEach(()=>page.ngOnDestroy());
  it('marks a notification before opening its related movement',()=>{page.abrir(notification(100));expect(api.leer).toHaveBeenCalledWith(100);expect(router.navigateByUrl).toHaveBeenCalledWith('/transacciones/5');});
  it('does not change read state or navigate when marking fails',()=>{
    api.leer.and.returnValue(throwError(()=>({status:503})));page.abrir(notification(100));expect(router.navigateByUrl).not.toHaveBeenCalled();expect(page.error).toContain('No se pudo');
  });
  it('does not send another mark request for a read notification',()=>{page.abrir(notification(100,true));expect(api.leer).not.toHaveBeenCalled();expect(router.navigateByUrl).toHaveBeenCalled();});
  it('uses the first page boundary for marking all even on an older page',()=>{
    api.listar.and.returnValue(of({content:[notification(70)],totalPages:2}));page.cambiarPagina(1);page.leerTodas();expect(api.leerTodas).toHaveBeenCalledWith(100);
  });
  it('rejects notification links outside the app resource routes',()=>{
    page.abrir({...notification(100,true),enlace:'https://example.test'});expect(router.navigateByUrl).not.toHaveBeenCalled();expect(page.error).toContain('enlace');
  });
});
