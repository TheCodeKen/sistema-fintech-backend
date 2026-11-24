export function importeValido(value: unknown, minimo = 0.01): boolean {
  const monto = Number(value);
  return value !== null && value !== '' && Number.isFinite(monto) && monto >= minimo
    && monto <= 9999999999999.99 && Math.abs(monto * 100 - Math.round(monto * 100)) < 0.001;
}

export function emailValido(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim()) && value.trim().length <= 100;
}

export function errorTransferencia(origen: string | undefined, destino: string | undefined): string {
  if (!destino || !/^FT\d{8}$/.test(destino.trim().toUpperCase())) return 'Ingresa una cuenta destino válida: FT y 8 dígitos.';
  return origen === destino.trim().toUpperCase() ? 'Elige una cuenta de destino diferente a la de origen.' : '';
}
