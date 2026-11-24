import { importeValido, emailValido, errorTransferencia } from './form-rules';
describe('Financial form rules', () => {
  it('accepts amounts with two decimal places', () => expect(importeValido(125.25)).toBeTrue());
  it('rejects negative, empty, infinite and fractional-cent amounts', () => {
    for (const value of [-1, '', null, Infinity, 1.001]) expect(importeValido(value)).toBeFalse();
  });
  it('enforces the minimum loan amount', () => {
    expect(importeValido(499.99, 500)).toBeFalse(); expect(importeValido(500, 500)).toBeTrue();
  });
  it('rejects malformed emails', () => expect(emailValido('persona@')).toBeFalse());
  it('rejects transfers to the same account', () => expect(errorTransferencia('FT12345678', 'FT12345678')).toContain('diferente'));
  it('accepts a valid destination', () => expect(errorTransferencia('FT12345678', 'ft87654321')).toBe(''));
});
