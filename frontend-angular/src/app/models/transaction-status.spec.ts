import { admiteReversion, estadoMovimiento } from './transaction-status';
import { Transaccion } from './models';

describe('Movement states',()=>{
  const movement=(estado:Transaccion['estado'],tipo:Transaccion['tipoTransaccion']='TRANSFERENCIA'):Transaccion=>({cuentaOrigenId:1,tipoTransaccion:tipo,monto:10,estado});
  it('only offers independent reversal for ordinary completed movements',()=>{
    expect(admiteReversion(movement('COMPLETADA'))).toBeTrue();
    for(const tipo of ['REVERSION','PAGO_PRESTAMO','DESEMBOLSO_PRESTAMO'] as Transaccion['tipoTransaccion'][])
      expect(admiteReversion(movement('COMPLETADA',tipo))).toBeFalse();
    expect(admiteReversion(movement('REVERTIDA'))).toBeFalse();
  });
  it('explains ambiguous states without promising that no funds moved',()=>{
    expect(estadoMovimiento(movement('PROCESANDO'))).toContain('pendiente de confirmar');
    expect(estadoMovimiento(movement('PENDIENTE'))).toContain('No repitas');
  });
  it('distinguishes failed and compensating operations',()=>{
    expect(estadoMovimiento(movement('FALLIDA'))).toContain('No se aplicaron');
    expect(estadoMovimiento(movement('COMPLETADA','REVERSION'))).toContain('compensa');
  });
});
