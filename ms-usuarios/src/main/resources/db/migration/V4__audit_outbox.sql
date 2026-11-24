CREATE TABLE eventos_pendientes (
    evento_id VARCHAR(64) NOT NULL PRIMARY KEY,
    usuario_ejecutor VARCHAR(150) NOT NULL,
    rol_ejecutor VARCHAR(30) NOT NULL,
    accion VARCHAR(80) NOT NULL,
    entidad_afectada VARCHAR(40) NOT NULL,
    entidad_id BIGINT NOT NULL,
    detalles VARCHAR(2000),
    fecha_registro DATETIME(6) NOT NULL,
    ip_origen VARCHAR(45),
    INDEX idx_evento_fecha(fecha_registro)
) ENGINE=InnoDB;
