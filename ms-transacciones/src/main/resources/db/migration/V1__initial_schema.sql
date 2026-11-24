-- Versioned schema; Hibernate does not mutate production tables.
CREATE TABLE IF NOT EXISTS `alertas` (
  `id` bigint NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `tipo_alerta` enum('CUENTA_NUEVA_CON_ALTO_MOVIMIENTO','INTENTOS_FALLIDOS','MONTO_ELEVADO','TRANSACCION_REPETITIVA') NOT NULL,
  `nivel_riesgo` enum('ALTO','BAJO','CRITICO','MEDIO') NOT NULL,
  `estado` enum('DESCARTADA','EN_REVISION','PENDIENTE','RESUELTA') NOT NULL,
  `numero_cuenta` varchar(20) NOT NULL,
  `transaccion_id` bigint,
  `descripcion` varchar(1000) NOT NULL,
  `observacion_resolucion` varchar(1000),
  `fecha_deteccion` datetime(6) NOT NULL,
  `fecha_resolucion` datetime(6)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `eventos_pendientes` (
  `evento_id` varchar(64) NOT NULL PRIMARY KEY,
  `usuario_ejecutor` varchar(150) NOT NULL,
  `rol_ejecutor` varchar(30) NOT NULL,
  `accion` varchar(80) NOT NULL,
  `entidad_afectada` varchar(40) NOT NULL,
  `entidad_id` bigint NOT NULL,
  `detalles` varchar(2000),
  `fecha_registro` datetime(6) NOT NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `transacciones` (
  `id` bigint NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `operacion_id` varchar(120) UNIQUE,
  `huella` varchar(64),
  `cuenta_origen_id` bigint NOT NULL,
  `cuenta_destino_id` bigint,
  `transaccion_padre_id` bigint,
  `tipo_transaccion` enum('DEPOSITO','DESEMBOLSO_PRESTAMO','PAGO','PAGO_PRESTAMO','RETIRO','REVERSION','TRANSFERENCIA') NOT NULL,
  `monto` decimal(15,2) NOT NULL,
  `moneda` varchar(3),
  `descripcion` varchar(255),
  `estado` enum('CANCELADA','COMPLETADA','FALLIDA','PENDIENTE','PROCESANDO','REVERTIDA'),
  `fecha_transaccion` datetime(6),
  `numero_referencia` varchar(30) UNIQUE
) ENGINE=InnoDB;
