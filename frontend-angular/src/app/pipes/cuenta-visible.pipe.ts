import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'cuentaVisible',
  standalone: true
})
export class CuentaVisiblePipe implements PipeTransform {
  transform(numeroCuenta: string | null | undefined): string {
    if (!numeroCuenta) return '—';

    return `****${numeroCuenta.slice(-4)}`;
  }
}