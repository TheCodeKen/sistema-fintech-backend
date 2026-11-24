// ── Usuario ────────────────────────────────────────────────────────────────
export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  autenticado: boolean;
  mensaje: string;
  usuarioId: number;
  nombre: string;
  apellido: string;
  email: string;
  rol: string;
  token: string;
}

export interface RegistroRequest {
  email: string;
  password: string;
  nombre: string;
  apellido: string;
  telefono?: string;
}

export interface Usuario {
  id?: number;
  email: string;
  password?: string;
  nombre: string;
  apellido: string;
  telefono?: string;
  dni?: string;
  rol: 'ADMIN' | 'CLIENTE';
  activo?: boolean;
  fechaRegistro?: string;
}

// ── Cuenta ─────────────────────────────────────────────────────────────────
export interface Cuenta {
  id?: number;
  numeroCuenta?: string;
  usuarioId: number;
  tipoCuenta: 'AHORRO' | 'AHORROS' | 'CORRIENTE' | 'PLAZO_FIJO';
  saldo?: number;
  saldoInicial?: number;
  moneda?: string;
  estado?: 'PENDIENTE_VERIFICACION' | 'ACTIVA' | 'BLOQUEADA' | 'CONGELADA' | 'INACTIVA' | 'CERRADA';
  fechaApertura?: string;
}

export interface PageResponse<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  number: number;
  size: number;
  first: boolean;
  last: boolean;
}

export interface Auditoria {
  id: number;
  usuarioEjecutor: string;
  rolEjecutor: string;
  accion: string;
  entidadAfectada: string;
  entidadId: number;
  detalles?: string;
  fechaRegistro: string;
  ipOrigen?: string;
}

export interface Alerta {
  id: number;
  tipoAlerta: string;
  nivelRiesgo: 'BAJO' | 'MEDIO' | 'ALTO' | 'CRITICO';
  estado: 'PENDIENTE' | 'EN_REVISION' | 'RESUELTA' | 'DESCARTADA';
  numeroCuenta: string;
  transaccionId?: number;
  descripcion: string;
  observacionResolucion?: string;
  fechaDeteccion: string;
  fechaResolucion?: string;
}

// ── Transaccion ────────────────────────────────────────────────────────────
export interface Transaccion {
  id?: number;
  cuentaOrigenId: number;
  numeroCuentaOrigen?: string;
  cuentaDestinoId?: number;
  numeroCuentaDestino?: string;
  tipoTransaccion: 'DEPOSITO' | 'RETIRO' | 'TRANSFERENCIA' | 'PAGO' | 'DESEMBOLSO_PRESTAMO' | 'PAGO_PRESTAMO' | 'REVERSION';
  monto: number;
  moneda?: string;
  descripcion?: string;
  estado?: 'PENDIENTE' | 'PROCESANDO' | 'COMPLETADA' | 'FALLIDA' | 'CANCELADA' | 'REVERTIDA';
  transaccionPadreId?: number;
  fechaTransaccion?: string;
  numeroReferencia?: string;
}

export interface RevisionMovimiento {
  numeroCuentaOrigen: string;
  numeroCuentaDestino: string | null;
  moneda: string;
  monto: number;
  saldoDisponible: number;
  saldoEstimado: number;
}

export interface EvaluacionCliente {
  solicitud: Prestamo;
  fechaCorte: string;
  totalOtrosPrestamos: number;
  porEstado: Record<string,number>;
  saldos: {moneda:string;prestamosVigentes:number;saldoPendiente:number;cuotaMensual:number;cuotasVencidas:number;saldoVencido:number;primerVencimiento:string|null}[];
  prestamosSinCronograma: number;
  prestamosRecientes: Prestamo[];
  paginaPrestamos: number;
  totalPaginasPrestamos: number;
  totalPagos: number;
  pagosRecientes: {prestamoId:number;numeroPrestamo:string;moneda:string;monto:number;fechaPago:string|null;transaccionId:number|null}[];
}

export interface TransaccionDetalle {
  movimiento: Transaccion;
  original: Transaccion | null;
  reversion: Transaccion | null;
}

// ── Prestamo ───────────────────────────────────────────────
export interface Prestamo {
  fechaDesembolso?: string;
  fechaCancelacion?: string;
  motivoCancelacion?: string;
  id?: number;
  numeroPrestamo?: string;
  usuarioId: number;
  nombreUsuario?: string;
  cuentaDesembolsoId: number;
  numeroCuenta?: string;
  montoSolicitado: number;
  montoAprobado?: number;
  tasaInteres: number;
  plazoMeses: number;
  cuotaMensual?: number;
  tipoPrestamo: 'PERSONAL' | 'HIPOTECARIO' | 'VEHICULAR' | 'EMPRESARIAL' | 'CONSUMO';
  estado?: 'PENDIENTE' | 'EN_REVISION' | 'APROBADO' | 'DESEMBOLSADO' | 'RECHAZADO' | 'PAGADO' | 'VENCIDO' | 'CANCELADO';
  moneda?: string;
  fechaSolicitud?: string;
  fechaAprobacion?: string;
  fechaVencimiento?: string;
  saldoPendiente?: number;
  observacion?: string;
  motivoRechazo?: string;
}

export interface CuotaPrestamo {
  numero: number;
  vencimiento: string;
  importe: number;
  pagado: number;
  pendiente: number;
  estado: 'PENDIENTE' | 'PARCIAL' | 'PAGADA' | 'VENCIDA';
}
export interface PagoPrestamo {
  operacionId: string;
  cuentaId: number;
  monto: number;
  fechaPago: string | null;
  transaccionId: number | null;
  historico: boolean;
}
export interface PrestamoDetalle {
  prestamo: Prestamo;
  totalPactado: number;
  totalPagado: number;
  saldoVencido: number;
  proximoVencimiento: string | null;
  importeProximaCuota: number;
  cuotasPagadas: number;
  cuotasVencidas: number;
  cuotas: CuotaPrestamo[];
  pagos: PagoPrestamo[];
  advertencia: string | null;
}
