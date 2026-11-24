-- Versioned schema; Hibernate does not mutate production tables.
CREATE TABLE IF NOT EXISTS `cuentas` (
  `id` bigint NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `numero_cuenta` varchar(20) NOT NULL UNIQUE,
  `usuario_id` bigint NOT NULL,
  `tipo_cuenta` enum('AHORROS','CORRIENTE','PLAZO_FIJO') NOT NULL,
  `saldo` decimal(15,2) NOT NULL,
  `moneda` varchar(3),
  `estado` enum('ACTIVA','BLOQUEADA','CERRADA','CONGELADA','INACTIVA','PENDIENTE_VERIFICACION'),
  `fecha_apertura` datetime(6)
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

CREATE TABLE IF NOT EXISTS `movimientos_aplicados` (
  `operacion_id` varchar(120) NOT NULL PRIMARY KEY,
  `huella` varchar(255) NOT NULL
) ENGINE=InnoDB;
