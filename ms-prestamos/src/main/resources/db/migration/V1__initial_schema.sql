-- Versioned schema; Hibernate does not mutate production tables.
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

CREATE TABLE IF NOT EXISTS `pagos_aplicados` (
  `clave` varchar(120) NOT NULL PRIMARY KEY,
  `huella` varchar(200) NOT NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `prestamos` (
  `id` bigint NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `numero_prestamo` varchar(20) NOT NULL UNIQUE,
  `usuario_id` bigint NOT NULL,
  `cuenta_desembolso_id` bigint NOT NULL,
  `monto_solicitado` decimal(15,2) NOT NULL,
  `monto_aprobado` decimal(15,2),
  `tasa_interes` decimal(5,2) NOT NULL,
  `plazo_meses` int NOT NULL,
  `cuota_mensual` decimal(15,2),
  `saldo_pendiente` decimal(15,2) NOT NULL,
  `observacion` varchar(500),
  `motivo_rechazo` varchar(500),
  `estado` enum('APROBADO','CANCELADO','DESEMBOLSADO','EN_REVISION','PAGADO','PENDIENTE','RECHAZADO','VENCIDO') NOT NULL,
  `tipo_prestamo` enum('CONSUMO','EMPRESARIAL','HIPOTECARIO','PERSONAL','VEHICULAR') NOT NULL,
  `moneda` varchar(3),
  `fecha_solicitud` datetime(6),
  `fecha_aprobacion` datetime(6),
  `fecha_vencimiento` date,
  `nombre_usuario` varchar(200),
  `numero_cuenta` varchar(20)
) ENGINE=InnoDB;
