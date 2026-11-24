import { TestBed, ComponentFixture } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { provideRouter } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { UsuariosComponent } from './usuarios.component';
import { environment } from '../../../environments/environment';
import { Usuario } from '../../models/models';

describe('Admin user access and account consultation',()=>{
  let fixture:ComponentFixture<UsuariosComponent>;let page:UsuariosComponent;let http:HttpTestingController;
  const user:Usuario={id:8,nombre:'Ana',apellido:'Prueba',email:'ana@example.test',rol:'CLIENTE',activo:true};
  const empty={content:[],totalElements:0,totalPages:0};
  beforeEach(()=>{
    TestBed.configureTestingModule({imports:[UsuariosComponent,HttpClientTestingModule],providers:[provideNoopAnimations(),provideRouter([])]});
    fixture=TestBed.createComponent(UsuariosComponent);page=fixture.componentInstance;http=TestBed.inject(HttpTestingController);fixture.detectChanges();
  });
  afterEach(()=>{TestBed.inject(MatDialog).closeAll();fixture.destroy();http.verify();});
  it('cancels obsolete searches and recovers an unavailable list',()=>{
    const old=http.expectOne(r=>r.url===environment.msUsuariosUrl);page.busqueda='Ana';page.aplicarFiltros();expect(old.cancelled).toBeTrue();
    http.expectOne(r=>r.url===environment.msUsuariosUrl).flush({},{status:503,statusText:'Unavailable'});fixture.detectChanges();
    expect(fixture.nativeElement.textContent).not.toContain('No hay usuarios');fixture.nativeElement.querySelector('[role="alert"] button').click();
    http.expectOne(r=>r.url===environment.msUsuariosUrl).flush(empty);expect(page.errorCarga).toBe('');
  });
  it('requires confirmation for access changes and prevents duplicate requests',async()=>{
    http.expectOne(r=>r.url===environment.msUsuariosUrl).flush(empty);
    const pending=page.cambiarEstado(user);await page.cambiarEstado(user);http.expectNone(environment.msUsuariosUrl+'/8/estado');
    TestBed.inject(MatDialog).openDialogs[0].close(true);await pending;
    const request=http.expectOne(r=>r.url===environment.msUsuariosUrl+'/8/estado');expect(request.request.params.get('activo')).toBe('false');request.flush({...user,activo:false});
    http.expectOne(r=>r.url===environment.msUsuariosUrl).flush(empty);expect(page.cambiandoEstado).toBeFalse();
  });
  it('cancelling access confirmation never changes access',async()=>{
    http.expectOne(r=>r.url===environment.msUsuariosUrl).flush(empty);const pending=page.cambiarEstado(user);
    TestBed.inject(MatDialog).openDialogs[0].close(false);await pending;expect(page.cambiandoEstado).toBeFalse();http.expectNone(r=>r.method==='PATCH');
  });
  it('never shows accounts from the previously selected user',()=>{
    http.expectOne(r=>r.url===environment.msUsuariosUrl).flush(empty);page.verCuentas(user);const old=http.expectOne(environment.msCuentasUrl+'/usuario/8');
    page.verCuentas({...user,id:9,nombre:'Beatriz'});expect(old.cancelled).toBeTrue();
    http.expectOne(environment.msCuentasUrl+'/usuario/9').flush({},{status:503,statusText:'Unavailable'});fixture.detectChanges();
    expect(page.cuentasUsuario).toEqual([]);expect(page.errorCuentas).toContain('No pudimos');
    page.cargarCuentasSeleccionadas();http.expectOne(environment.msCuentasUrl+'/usuario/9').flush([]);expect(page.errorCuentas).toBe('');
  });
  it('retains edits when saving fails and cannot close during submission',()=>{
    http.expectOne(r=>r.url===environment.msUsuariosUrl).flush(empty);page.editarUsuario(user);page.form.nombre='Ana corregida';page.guardar();page.cerrarModal();
    expect(page.dialogRef).not.toBeNull();http.expectOne(environment.msUsuariosUrl+'/8').flush({message:'Revisa los datos'},{status:400,statusText:'Bad Request'});
    expect(page.form.nombre).toBe('Ana corregida');expect(page.formError).toContain('Revisa');
  });
});
