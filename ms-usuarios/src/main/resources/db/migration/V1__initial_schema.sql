-- Versioned schema; Hibernate does not mutate production tables.
CREATE TABLE IF NOT EXISTS `auditoria` (
  `id` bigint NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `evento_id` varchar(64) UNIQUE,
  `usuario_ejecutor` varchar(150) NOT NULL,
  `rol_ejecutor` varchar(30) NOT NULL,
  `accion` varchar(80) NOT NULL,
  `entidad_afectada` varchar(40) NOT NULL,
  `entidad_id` bigint NOT NULL,
  `detalles` varchar(2000),
  `fecha_registro` datetime(6) NOT NULL,
  `ip_origen` varchar(45)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `usuarios` (
  `id` bigint NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `token_version` int,
  `email` varchar(100) NOT NULL UNIQUE,
  `password` varchar(255) NOT NULL,
  `nombre` varchar(100) NOT NULL,
  `apellido` varchar(100) NOT NULL,
  `telefono` varchar(20),
  `dni` varchar(20) UNIQUE,
  `rol` enum('ADMIN','CLIENTE') NOT NULL,
  `activo` bit NOT NULL,
  `fecha_registro` datetime(6)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `password_reset_tokens` (
  `id` bigint NOT NULL AUTO_INCREMENT PRIMARY KEY UNIQUE,
  `token` varchar(100) NOT NULL UNIQUE,
  `usuario_id` bigint NOT NULL,
  `fecha_creacion` datetime(6) NOT NULL,
  `fecha_expiracion` datetime(6) NOT NULL,
  `usado` bit NOT NULL,
  `fecha_uso` datetime(6)
) ENGINE=InnoDB;
