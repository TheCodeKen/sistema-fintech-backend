CREATE TABLE aperturas_cuenta (
    usuario_ejecutor BIGINT NOT NULL,
    clave VARCHAR(64) NOT NULL,
    huella CHAR(64) NOT NULL,
    cuenta_id BIGINT NULL,
    PRIMARY KEY (usuario_ejecutor, clave),
    CONSTRAINT fk_apertura_cuenta FOREIGN KEY (cuenta_id) REFERENCES cuentas(id)
) ENGINE=InnoDB;
