ALTER TABLE transacciones ADD COLUMN usuario_origen_id BIGINT NULL, ADD COLUMN usuario_destino_id BIGINT NULL;
CREATE TABLE avisos_pendientes (
    clave VARCHAR(180) NOT NULL PRIMARY KEY,
    usuario_id BIGINT NOT NULL,
    tipo VARCHAR(40) NOT NULL,
    recurso_id BIGINT NOT NULL,
    titulo VARCHAR(120) NOT NULL,
    mensaje VARCHAR(600) NOT NULL,
    fecha_evento DATETIME(6) NOT NULL,
    fecha_entrega DATETIME(6) NULL,
    INDEX idx_aviso_entrega(fecha_entrega,fecha_evento)
);
