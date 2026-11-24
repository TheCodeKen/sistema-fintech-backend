import { fakeAsync, tick } from '@angular/core/testing';
import { Subject } from 'rxjs';
import { LoginComponent } from './login/login.component';
import { RegistroComponent } from './registro/registro.component';

describe('Access forms prevent duplicate submissions',()=>{
  let response:Subject<any>;let auth:any;let router:any;
  beforeEach(()=>{response=new Subject();auth={isLoggedIn:()=>false,login:jasmine.createSpy().and.returnValue(response),register:jasmine.createSpy().and.returnValue(response)};router={navigate:jasmine.createSpy()};});
  it('normalizes email and submits login only once while keeping invalid credentials editable',()=>{
    const page=new LoginComponent(auth,router);page.email=' ANA@EXAMPLE.TEST ';page.password='Prueba123!';page.onLogin();page.onLogin();
    expect(auth.login.calls.count()).toBe(1);expect(auth.login.calls.mostRecent().args[0].email).toBe('ana@example.test');
    response.error({status:401});expect(page.loading).toBeFalse();expect(page.password).toBe('Prueba123!');expect(router.navigate).not.toHaveBeenCalled();page.ngOnDestroy();
  });
  it('never navigates to the dashboard for a login that was not authenticated',()=>{
    const page=new LoginComponent(auth,router);page.email='ana@example.test';page.password='Prueba123!';page.onLogin();response.next({autenticado:false});
    expect(page.error).toContain('No se pudo');expect(router.navigate).not.toHaveBeenCalled();page.ngOnDestroy();
  });
  it('validates trimmed registration data and retains it after an ambiguous failure',()=>{
    const page=new RegistroComponent(auth,router);page.form={nombre:'  ',apellido:'Prueba',email:'ana@example.test',password:'Prueba123!',telefono:''};page.onRegistro();expect(auth.register).not.toHaveBeenCalled();
    page.form.nombre=' Ana ';page.form.password='x'.repeat(73);page.onRegistro();expect(auth.register).not.toHaveBeenCalled();
    page.form.password='Prueba123!';page.onRegistro();page.onRegistro();expect(auth.register.calls.count()).toBe(1);expect(auth.register.calls.mostRecent().args[0].nombre).toBe('Ana');
    response.error({status:503});expect(page.loading).toBeFalse();expect(page.form.nombre).toBe(' Ana ');expect(page.error).toContain('Conservamos');page.ngOnDestroy();
  });
  it('cancels delayed registration navigation when the user leaves',fakeAsync(()=>{
    const page=new RegistroComponent(auth,router);page.form={nombre:'Ana',apellido:'Prueba',email:'ana@example.test',password:'Prueba123!',telefono:''};page.onRegistro();response.next({autenticado:true});page.ngOnDestroy();tick(1300);
    expect(router.navigate).not.toHaveBeenCalled();
  }));
});
