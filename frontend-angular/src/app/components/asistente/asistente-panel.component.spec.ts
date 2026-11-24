import { of, Subject, throwError } from 'rxjs';
import { AsistentePanelComponent } from './asistente-panel.component';
describe('Read-only role-based assistant panel',()=>{
  let page:AsistentePanelComponent;let api:any;let auth:any;let ref:any;
  beforeEach(()=>{
    api={estado:()=>of({disponible:true,administrador:false,proveedor:'OpenAI'}),conversar:jasmine.createSpy().and.returnValue(of({respuesta:'Revisa el detalle.',fuentes:[],modo:'CLIENTE',datosConsultados:false}))};
    auth={getSession:()=>({usuarioId:2,rol:'CLIENTE'})};ref={close:jasmine.createSpy()};page=new AsistentePanelComponent(api,auth,{url:'/transacciones/5'} as any,ref);page.ngOnInit();
  });
  afterEach(()=>page.ngOnDestroy());
  it('does not enable financial queries by default or allow client admin mode',()=>{
    expect(page.consultarDatos).toBeFalse();page.cambiarModo('ADMIN');expect(page.modo).toBe('CLIENTE');page.pregunta='Guíame';page.enviar();expect(api.conversar.calls.mostRecent().args[0].consultarDatos).toBeFalse();
  });
  it('includes the selected record in contextual suggestions after permission',()=>{page.consultarDatos=true;expect(page.sugerencias[0]).toContain('#5');});
  it('blocks duplicate sends while a response is pending',()=>{
    api.conversar.and.returnValue(new Subject());page.pregunta='Pregunta';page.enviar();page.enviar();expect(api.conversar).toHaveBeenCalledTimes(1);
  });
  it('restores the question on failure and never invents a successful answer',()=>{
    api.conversar.and.returnValue(throwError(()=>({error:{message:'No disponible'}})));page.pregunta='Mi préstamo';page.enviar();expect(page.pregunta).toBe('Mi préstamo');expect(page.mensajes.length).toBe(0);expect(page.error).toBe('No disponible');
  });
  it('clears previous data context when permission changes',()=>{page.pregunta='Consulta';page.enviar();expect(page.mensajes.length).toBe(2);page.consultarDatos=true;page.cambiarPermiso();expect(page.mensajes.length).toBe(0);});
  it('discards external source links',()=>{
    api.conversar.and.returnValue(of({respuesta:'Respuesta',fuentes:[{titulo:'Ajeno',enlace:'https://evil.test'},{titulo:'Válido',enlace:'/prestamos/1'}]}));page.pregunta='Consulta';page.enviar();expect(page.mensajes[1].fuentes?.length).toBe(1);
  });
  it('closes without sending history if the authenticated user changes',()=>{
    auth.getSession=()=>({usuarioId:3,rol:'CLIENTE'});page.pregunta='Consulta';page.enviar();expect(ref.close).toHaveBeenCalled();expect(api.conversar).not.toHaveBeenCalled();
  });
  it('shows local processing and explains a missing local model',()=>{
    api.estado=()=>of({disponible:false,administrador:false,proveedor:'Ollama local',procesamientoLocal:true});page.comprobar();
    expect(page.procesamientoLocal).toBeTrue();expect(page.disponible).toBeFalse();expect(page.estadoError).toContain('modelo local');
  });
});
