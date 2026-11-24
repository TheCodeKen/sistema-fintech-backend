import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { AuthService } from './auth.service';
describe('AuthService session lifecycle', () => {
  let service: AuthService;
  beforeEach(() => { sessionStorage.clear(); TestBed.configureTestingModule({imports:[HttpClientTestingModule]}); service=TestBed.inject(AuthService); });
  afterEach(() => sessionStorage.clear());
  it('clears malformed session data', () => {
    sessionStorage.setItem('fintech_user','{');
    expect(service.isLoggedIn()).toBeFalse();
    expect(sessionStorage.getItem('fintech_user')).toBeNull();
  });
  it('rejects an expired token', () => {
    sessionStorage.setItem('fintech_user',JSON.stringify({usuarioId:2}));
    sessionStorage.setItem('fintech_token','x.'+btoa(JSON.stringify({exp:1}))+'.x');
    expect(service.isLoggedIn()).toBeFalse();
    expect(service.getToken()).toBeNull();
  });
  it('retains an unexpired session', () => {
    sessionStorage.setItem('fintech_user',JSON.stringify({usuarioId:2}));
    sessionStorage.setItem('fintech_token','x.'+btoa(JSON.stringify({exp:Math.floor(Date.now()/1000)+60}))+'.x');
    expect(service.isLoggedIn()).toBeTrue();
  });
});
