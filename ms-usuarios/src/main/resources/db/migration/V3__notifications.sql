CREATE TABLE notificaciones (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    clave VARCHAR(180) NOT NULL,
    usuario_id BIGINT NOT NULL,
    tipo VARCHAR(40) NOT NULL,
    recurso_id BIGINT NOT NULL,
    titulo VARCHAR(120) NOT NULL,
    mensaje VARCHAR(600) NOT NULL,
    fecha_evento DATETIME(6) NOT NULL,
    leida_en DATETIME(6) NULL,
    CONSTRAINT uk_notificacion_clave UNIQUE(clave),
    CONSTRAINT fk_notificacion_usuario FOREIGN KEY(usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
    INDEX idx_notificacion_usuario(usuario_id,id),
    INDEX idx_notificacion_no_leida(usuario_id,leida_en,id)
);
