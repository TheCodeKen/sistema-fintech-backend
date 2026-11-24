import { Transaccion } from './models';

export function estadoMovimiento(t:Transaccion):string {
  switch(t.estado){
    case 'COMPLETADA': return t.tipoTransaccion==='REVERSION' ? 'Reversión completada. Este movimiento compensa la operación original.' : 'Movimiento completado. El importe se aplicó a las cuentas indicadas.';
    case 'REVERTIDA': return 'Movimiento revertido. Consulta la operación compensatoria vinculada; el movimiento original se conserva en el historial.';
    case 'FALLIDA': return 'Movimiento rechazado. No se aplicaron cambios de saldo por esta operación.';
    case 'CANCELADA': return 'Movimiento cancelado. No está confirmado como completado.';
    default: return 'Resultado pendiente de confirmar. No repitas el movimiento con otros datos. Retoma la operación original y conserva su clave.';
  }
}

export function admiteReversion(t:Transaccion):boolean {
  return t.estado==='COMPLETADA' && ['DEPOSITO','RETIRO','TRANSFERENCIA','PAGO'].includes(t.tipoTransaccion);
}
