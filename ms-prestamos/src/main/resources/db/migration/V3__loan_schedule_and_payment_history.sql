ALTER TABLE prestamos ADD COLUMN fecha_desembolso DATE NULL,
    ADD COLUMN fecha_cancelacion DATETIME(6) NULL, ADD COLUMN motivo_cancelacion VARCHAR(500) NULL;
ALTER TABLE pagos_aplicados ADD COLUMN prestamo_id BIGINT NULL,
    ADD COLUMN cuenta_id BIGINT NULL, ADD COLUMN monto DECIMAL(15,2) NULL,
    ADD COLUMN fecha_pago DATETIME(6) NULL, ADD COLUMN transaccion_id BIGINT NULL;
-- Legacy ledger stored the loan/account/amount in these exact key and fingerprint formats.
-- Unknown timestamps and transaction IDs intentionally remain NULL.
UPDATE pagos_aplicados SET
    prestamo_id=CAST(SUBSTRING_INDEX(SUBSTRING_INDEX(clave,':',2),':',-1) AS UNSIGNED),
    cuenta_id=CAST(SUBSTRING_INDEX(huella,':',1) AS UNSIGNED),
    monto=CAST(SUBSTRING_INDEX(huella,':',-1) AS DECIMAL(15,2))
WHERE clave REGEXP '^prestamo:[0-9]+:pago:' AND huella REGEXP '^[0-9]+:[0-9]+([.][0-9]+)?$';
CREATE INDEX idx_pago_prestamo ON pagos_aplicados(prestamo_id,fecha_pago);
CREATE TABLE cuotas_prestamo (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    prestamo_id BIGINT NOT NULL,
    numero INT NOT NULL,
    vencimiento DATE NOT NULL,
    importe DECIMAL(15,2) NOT NULL,
    pagado DECIMAL(15,2) NOT NULL,
    CONSTRAINT uk_cuota_numero UNIQUE(prestamo_id,numero),
    CONSTRAINT fk_cuota_prestamo FOREIGN KEY(prestamo_id) REFERENCES prestamos(id),
    CONSTRAINT ck_cuota_importes CHECK(importe>=0 AND pagado>=0 AND pagado<=importe),
    INDEX idx_cuota_vencimiento(vencimiento)
);
