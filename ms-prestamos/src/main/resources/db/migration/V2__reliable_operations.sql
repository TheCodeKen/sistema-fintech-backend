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
