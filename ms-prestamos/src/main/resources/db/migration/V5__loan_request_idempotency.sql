CREATE TABLE solicitudes_prestamo (
    usuario_ejecutor BIGINT NOT NULL,
    clave VARCHAR(64) NOT NULL,
    huella CHAR(64) NOT NULL,
    prestamo_id BIGINT NULL,
    PRIMARY KEY (usuario_ejecutor, clave),
    CONSTRAINT fk_solicitud_prestamo FOREIGN KEY (prestamo_id) REFERENCES prestamos(id)
) ENGINE=InnoDB;
