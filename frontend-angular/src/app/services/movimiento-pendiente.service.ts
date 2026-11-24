import { Injectable } from '@angular/core';
import { AuthService } from './auth.service';
import { Transaccion } from '../models/models';
import { importeValido } from '../models/form-rules';

export interface MovimientoPendiente { operacionId:string; movimiento:Transaccion; }

/** Keep the exact request and operation key until the server confirms a terminal result. */
@Injectable({providedIn:'root'})
export class MovimientoPendienteService {
  constructor(private auth:AuthService){}
  private get key():string{return `fintech_movimiento_${this.auth.getSession()?.usuarioId}`;}
  leer():MovimientoPendiente|null {
    try {
      const raw=sessionStorage.getItem(this.key);if(!raw)return null;
      const p=JSON.parse(raw) as MovimientoPendiente;
      if(!/^[A-Za-z0-9:_-]{8,64}$/.test(p.operacionId)||!p.movimiento||!importeValido(p.movimiento.monto)
          ||!['DEPOSITO','RETIRO','TRANSFERENCIA','PAGO'].includes(p.movimiento.tipoTransaccion))return null;
      return p;
    }catch{return null;}
  }
  guardar(operacionId:string,movimiento:Transaccion):void {
    sessionStorage.setItem(this.key,JSON.stringify({operacionId,movimiento}));
  }
  limpiar():void {sessionStorage.removeItem(this.key);}
}
