-- Versioned schema; Hibernate does not mutate production tables.
CREATE TABLE `auditoria` (
  `id` bigint NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `evento_id` varchar(64) NOT NULL UNIQUE,
  `legacy_id` bigint UNIQUE,
  `usuario_ejecutor` varchar(150) NOT NULL,
  `rol_ejecutor` varchar(30) NOT NULL,
  `accion` varchar(80) NOT NULL,
  `entidad_afectada` varchar(40) NOT NULL,
  `entidad_id` bigint NOT NULL,
  `detalles` varchar(2000),
  `fecha_registro` datetime(6) NOT NULL,
  `ip_origen` varchar(45),
  INDEX idx_auditoria_fecha(fecha_registro),
  INDEX idx_auditoria_entidad(entidad_afectada,entidad_id)
) ENGINE=InnoDB;

